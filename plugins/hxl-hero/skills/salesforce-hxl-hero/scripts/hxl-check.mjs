#!/usr/bin/env node
// Checks the chain of a Salesforce Headless Experience Layer (HXL) project the
// way Polyglot Arcade's headless surface is built: MCP server tools that run
// Apex invocable actions, envelope and response Lightning types that map the
// result onto a UI widget, the widget itself, the permission sets that grant
// the tool classes, the External Client App clients sign in with, and the
// setting that turns HXL on. It maps the chain per tool and reports what has
// one right answer between the pieces.
//
//   node hxl-check.mjs [path] [--errors-only] [--json]
//
// The project root is the nearest folder with sfdx-project.json above the path
// (default: the working directory). Errors break a tool or its widget, warnings
// are worth a look in every review, infos are hints. The exit code is 1 when
// there is an error.
//
// A finding the team decided to keep is suppressed with a reason, or the
// suppression does not count - in an XML or Apex file anywhere in the file:
//
//   <!-- hxl-ignore <rule> -- <reason> -->
//   // hxl-ignore <rule> -- <reason>
//
// and for JSON files, which have no comments, in .hxl-check-ignore at the root:
//
//   <rule> <path relative to the root> -- <reason>

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIPPED_FOLDERS = new Set(['node_modules', '.git', '.sf', '.sfdx', '.localdevserver', 'coverage', 'dist']);
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
const ONE_REQUEST = /exactly one|one (?:request|object|entry) per call|once (?:per|for each)/i;

// ------------------------------------------------------------------- reading

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Text of the first <tag> element, or undefined - also when a formatter put the > on the next line. */
function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}\\s*>([\\s\\S]*?)</${name}\\s*>`));
  return match ? match[1].trim() : undefined;
}

/** Inner XML of every <name> block. */
function blocks(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}\\s*>([\\s\\S]*?)</${name}\\s*>`, 'g'))].map((m) => m[1]);
}

/** Apex source with comments blanked out - not inside strings, where a URL has a // too. */
export function apexCode(source) {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "'") {
      const start = i;
      i++;
      while (i < source.length && source[i] !== "'") i += source[i] === '\\' ? 2 : 1;
      out += source.slice(start, i + 1);
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 1;
      out += ' ';
    } else out += c;
  }
  return out;
}

/** Index after the balanced (...) that starts at or after `from`, skipping quoted text. */
function skipParens(code, from) {
  let i = code.indexOf('(', from);
  if (i < 0) return from;
  let depth = 0;
  for (; i < code.length; i++) {
    const c = code[i];
    if (c === "'") {
      i++;
      while (i < code.length && code[i] !== "'") i += code[i] === '\\' ? 2 : 1;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return code.length;
}

/** The body of `class <name> ... { ... }` in Apex code, or undefined. */
export function classBody(code, name) {
  const match = new RegExp(`\\bclass\\s+${name}\\b[^{]*\\{`, 'i').exec(code);
  if (!match) return undefined;
  let depth = 0;
  for (let i = match.index + match[0].length - 1; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(match.index + match[0].length, i);
  }
  return undefined;
}

/** Names of the @InvocableVariable fields in an Apex class body. */
export function invocableVariables(body) {
  const names = [];
  const pattern = /@InvocableVariable\b/gi;
  let match;
  while ((match = pattern.exec(body))) {
    let i = match.index + match[0].length;
    if (/^\s*\(/.test(body.slice(i))) i = skipParens(body, i);
    const declaration = body.slice(i, body.indexOf(';', i));
    const name = declaration.trim().split(/\s+/).pop();
    if (name && /^\w+$/.test(name)) names.push(name);
  }
  return names;
}

/** The response class of an invocable action: the element type of its List<...> return. */
export function invocableOutputs(source) {
  const code = apexCode(source);
  const at = code.search(/@InvocableMethod\b/i);
  if (at < 0) return undefined;
  let after = at + '@InvocableMethod'.length;
  if (/^\s*\(/.test(code.slice(after))) after = skipParens(code, after);
  const signature = code.slice(after).match(/List\s*<\s*([\w.]+)\s*>\s+\w+\s*\(/);
  if (!signature) return undefined;
  const responseClass = signature[1].split('.').pop();
  const body = classBody(code, responseClass);
  return body === undefined ? undefined : { responseClass, outputs: invocableVariables(body) };
}

// ------------------------------------------------------------------ discovery

/** The nearest folder with sfdx-project.json at or above the path, else the path. */
export function findRoot(path) {
  const start = resolve(path);
  let dir = existsSync(start) && statSync(start).isFile() ? dirname(start) : start;
  for (;;) {
    if (existsSync(join(dir, 'sfdx-project.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile()) out.push(join(dir, entry.name));
  }
  return out;
}

const parentName = (file) => basename(dirname(file));
const grandParentName = (file) => basename(dirname(dirname(file)));

/** Every piece of the HXL chain in the project. */
export function discover(root) {
  const files = walk(root);
  const map = {
    root,
    widgets: {},
    types: {},
    servers: [],
    classes: {},
    permissionSets: [],
    eca: { apps: [], oauth: [], global: [] },
    hxlSetting: undefined,
    scratchDefHxl: false,
    ignoreFile: join(root, '.hxl-check-ignore')
  };

  for (const file of files) {
    const name = basename(file);
    if (grandParentName(file) === 'uiWidgets') {
      const widget = parentName(file);
      const entry = (map.widgets[widget] ??= { name: widget, dir: dirname(file) });
      if (name === `${widget}.json`) entry.bodyFile = file;
      else if (name === 'schema.json') entry.schemaFile = file;
      else if (name === `${widget}.uiwidget-meta.xml`) entry.metaFile = file;
    } else if (grandParentName(file) === 'lightningTypes') {
      const type = parentName(file);
      const entry = (map.types[type] ??= { name: type, dir: dirname(file) });
      if (name === 'schema.json') entry.schemaFile = file;
      else if (name === 'renderer.json') entry.rendererFile = file;
    } else if (name.endsWith('.mcpServerDefinition-meta.xml')) {
      const xml = read(file);
      map.servers.push({
        name: name.replace('.mcpServerDefinition-meta.xml', ''),
        file,
        tools: blocks(xml, 'tools').map((t) => ({
          name: tag(t, 'toolName'),
          uiResource: tag(t, 'uiResource'),
          apiIdentifier: tag(t, 'apiIdentifier'),
          description: tag(t, 'descriptionOverride') ?? '',
          readOnly: tag(t, 'readOnly')
        })),
        resources: blocks(xml, 'resources').map((r) => ({ name: tag(r, 'resourceName'), uri: tag(r, 'resourceUri') }))
      });
    } else if (name.endsWith('.cls') && !name.endsWith('-meta.xml')) {
      map.classes[name.replace(/\.cls$/, '')] = file;
    } else if (name.endsWith('.permissionset-meta.xml')) {
      const xml = read(file);
      map.permissionSets.push({
        name: name.replace('.permissionset-meta.xml', ''),
        file,
        classes: blocks(xml, 'classAccesses')
          .filter((b) => tag(b, 'enabled') === 'true')
          .map((b) => tag(b, 'apexClass'))
      });
    } else if (name.endsWith('.eca-meta.xml')) map.eca.apps.push({ name: name.replace('.eca-meta.xml', ''), file });
    else if (name.endsWith('.ecaOauth-meta.xml')) map.eca.oauth.push({ file });
    else if (name.endsWith('.ecaGlblOauth-meta.xml')) map.eca.global.push({ file });
    else if (name === 'UiWidget.settings-meta.xml')
      map.hxlSetting = { file, on: tag(read(file), 'hxlEnabled') === 'true' };
    else if (/scratch-def\.json$/.test(name) && readJson(file)?.settings?.uiWidgetSettings?.hxlEnabled === true) {
      map.scratchDefHxl = true;
    }
  }

  for (const widget of Object.values(map.widgets)) {
    widget.body = widget.bodyFile && readJson(widget.bodyFile);
    widget.schema = widget.schemaFile && readJson(widget.schemaFile);
    widget.attributes = widget.schema?.properties?.attributes?.properties ?? {};
  }
  for (const type of Object.values(map.types)) {
    type.schema = type.schemaFile && readJson(type.schemaFile);
    type.renderer = type.rendererFile && readJson(type.rendererFile);
    type.properties = type.schema?.properties ?? {};
    type.isEnvelope = 'outputValues' in type.properties;
  }
  map.chains = chainsOf(map);
  return map;
}

/** tool -> Apex class -> envelope type -> response type -> widget, as far as the files say. */
function chainsOf(map) {
  return map.servers.flatMap((server) =>
    server.tools.map((tool) => {
      const resource = server.resources.find((r) => r.name === tool.uiResource);
      const envelope = resource?.uri?.match(/^ui:\/\/widget\/lightningType\/c__(\w+)$/)?.[1];
      const response = map.types[envelope]?.properties?.outputValues?.['lightning:type']?.replace(/^c__/, '');
      const widget = map.types[envelope]?.renderer?.renderer?.componentOverrides?.$?.definition?.replace(
        /^@widget\/c\//,
        ''
      );
      return {
        server: server.name,
        serverFile: server.file,
        tool: tool.name,
        apexClass: tool.apiIdentifier?.match(/^aa:apex-(\w+)$/)?.[1],
        resource,
        envelope,
        response,
        widget
      };
    })
  );
}

// ---------------------------------------------------------------------- rules

/** Every {!...} expression in a widget body with the component it sits in. */
function expressions(node, scope = [], out = []) {
  if (!node || typeof node !== 'object') return out;
  const items = node.meta?.forItem ? [...scope, node.meta.forItem] : node.meta?.forEach ? [...scope, '$Item'] : scope;
  const visit = (value, where) => {
    if (typeof value === 'string') {
      for (const m of value.matchAll(/\{!([\s\S]*?)\}/g)) out.push({ expr: m[1], node, where, scope: items });
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, `${where}.${k}`);
    }
  };
  visit(node.attributes, 'attributes');
  if (node.meta?.if) visit(node.meta.if, 'meta.if');
  if (node.meta?.forEach)
    for (const m of node.meta.forEach.matchAll(/\{!([\s\S]*?)\}/g))
      out.push({ expr: m[1], node, where: 'meta.forEach', scope });
  for (const child of node.children ?? []) expressions(child, items, out);
  return out;
}

function components(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  for (const child of node.children ?? []) components(child, out);
  return out;
}

function widgetFindings(widget) {
  const findings = [];
  const add = (file, severity, rule, message) => findings.push({ file, severity, rule, message });
  const missing = [
    !widget.bodyFile && `${widget.name}.json`,
    !widget.schemaFile && 'schema.json',
    !widget.metaFile && `${widget.name}.uiwidget-meta.xml`
  ].filter(Boolean);
  if (missing.length) {
    add(
      widget.dir,
      'error',
      'widget-files',
      `Widget ${widget.name} misses ${missing.join(', ')} - a bundle has three files`
    );
  }
  const body = widget.body;
  if (widget.bodyFile && !body) add(widget.bodyFile, 'error', 'widget-root', 'The composition is not valid JSON');
  if (body) {
    if (body.type !== 'lightning__agentforceWidget' || body.contentBody?.widgetBody?.definition !== 'tile/widget') {
      add(
        widget.bodyFile,
        'error',
        'widget-root',
        'type must be lightning__agentforceWidget with a tile/widget root in contentBody.widgetBody'
      );
    }
    const root = body.contentBody?.widgetBody;
    for (const { expr, where } of expressions(root)) {
      for (const m of expr.matchAll(/\$attrs\.(\w+)/g)) {
        if (!(m[1] in widget.attributes)) {
          add(
            widget.bodyFile,
            'error',
            'widget-binding',
            `$attrs.${m[1]} (in ${where}) is not an attribute in schema.json`
          );
        }
      }
      const bare = where === 'meta.if' && expr.trim().match(/^\$attrs\.(\w+)$/);
      const type = bare && widget.attributes[bare[1]]?.['lightning:type'];
      if (type && type !== 'lightning__booleanType') {
        add(
          widget.bodyFile,
          'warning',
          'widget-if-boolean',
          `meta.if on ${bare[1]} (${type}) - if needs a boolean or a comparison`
        );
      }
    }
    for (const node of components(root)) {
      if (node.definition !== 'tile/button') continue;
      const actions = node.attributes?.actions?.click ?? [];
      if (!actions.some((a) => ['action/openLink', 'action/sendMessage'].includes(a.definition))) {
        add(
          widget.bodyFile,
          'warning',
          'widget-button-action',
          `Button "${node.attributes?.label ?? '?'}" has no click action - it renders disabled`
        );
      }
    }
  }
  for (const [name, attribute] of Object.entries(widget.attributes)) {
    if (attribute['lightning:type'] === 'lightning__listType' && !attribute.items?.['lightning:type']) {
      add(widget.schemaFile, 'error', 'widget-list-items', `List attribute ${name} has no items.lightning:type`);
    }
  }
  return findings;
}

function typeFindings(type, map) {
  const findings = [];
  const add = (file, severity, rule, message) => findings.push({ file, severity, rule, message });
  const file = type.schemaFile ?? type.dir;
  if (!type.schemaFile)
    return [
      { file, severity: 'error', rule: 'type-schema', message: `Lightning type ${type.name} has no schema.json` }
    ];
  if (!type.schema) return [{ file, severity: 'error', rule: 'type-schema', message: 'schema.json is not valid JSON' }];
  const objectBased = type.schema['lightning:type'] === 'lightning__objectType';

  for (const [name, property] of Object.entries(type.properties)) {
    const ref = property['lightning:type'] ?? '';
    if (ref === 'lightning__listType' || property.items) {
      add(
        file,
        'error',
        'type-list',
        `${name}: a list in a Lightning type is an @apexClassType reference, not lightning__listType with items`
      );
    }
    const apex = ref.match(/^@apexClassType\/c__(\w+)(?:\$(\w+))?$/);
    if (apex) {
      const classFile = map.classes[apex[1]];
      if (!classFile) {
        add(file, 'warning', 'type-apex-ref', `${name}: Apex class ${apex[1]} is not in this project`);
      } else if (apex[2] && !classBody(apexCode(read(classFile)), apex[2])) {
        add(file, 'error', 'type-apex-ref', `${name}: ${apex[1]} has no inner class ${apex[2]}`);
      }
    }
  }
  if (objectBased && type.schema.unevaluatedProperties !== false) {
    add(
      file,
      'warning',
      'type-unevaluated',
      'Object-based type without "unevaluatedProperties": false - the metaschema expects it'
    );
  }

  if (type.isEnvelope) {
    if (!type.schema['lightning:tags']?.includes('mcp'))
      add(file, 'warning', 'type-mcp-tag', 'Envelope type without "lightning:tags": ["mcp"]');
    const ref = type.properties.outputValues['lightning:type'] ?? '';
    const response = ref.match(/^c__(\w+)$/)?.[1];
    if (!response) {
      add(file, 'error', 'type-envelope-ref', 'outputValues must reference the response type as c__<name>');
    } else if (!map.types[response]) {
      add(file, 'error', 'type-envelope-ref', `outputValues references c__${response}, which is not in this project`);
    } else if (!map.types[response].schema?.['lightning:tags']?.includes('mcp')) {
      add(
        map.types[response].schemaFile ?? map.types[response].dir,
        'warning',
        'type-mcp-tag',
        'Response type without "lightning:tags": ["mcp"]'
      );
    }
  }

  if (type.rendererFile) {
    const override = type.renderer?.renderer?.componentOverrides?.$;
    const widgetName = override?.definition?.match(/^@widget\/c\/(\w+)$/)?.[1];
    if (!type.renderer) {
      add(type.rendererFile, 'error', 'renderer-widget', 'renderer.json is not valid JSON');
    } else if (override?.definition?.startsWith('@widget/')) {
      if (
        !type.isEnvelope &&
        Object.values(map.types).some((t) => t.properties?.outputValues?.['lightning:type'] === `c__${type.name}`)
      ) {
        add(
          type.rendererFile,
          'warning',
          'renderer-location',
          'The renderer belongs in the envelope type, not in the response type'
        );
      }
      const widget = widgetName && map.widgets[widgetName];
      if (!widget) {
        add(
          type.rendererFile,
          'error',
          'renderer-widget',
          `${override.definition} - no such widget in this project (use the c namespace)`
        );
      } else {
        const bound = override.attributes ?? {};
        for (const [attribute, value] of Object.entries(bound)) {
          if (!(attribute in widget.attributes)) {
            add(
              type.rendererFile,
              'error',
              'renderer-binding',
              `${attribute} is not an attribute of widget ${widgetName}`
            );
          }
          if (type.isEnvelope && !/^\{!\$attrs\.outputValues\./.test(String(value))) {
            add(
              type.rendererFile,
              'error',
              'renderer-outputvalues',
              `${attribute} binds ${value} - MCP results live under {!$attrs.outputValues.<output>}`
            );
          }
          const output = String(value).match(/^\{!\$attrs\.outputValues\.(\w+)/)?.[1];
          const response = map.types[type.properties.outputValues?.['lightning:type']?.replace(/^c__/, '')];
          if (output && response?.schema && !(output in response.properties)) {
            add(
              type.rendererFile,
              'error',
              'renderer-binding',
              `${attribute} binds outputValues.${output}, which the response type does not have`
            );
          }
        }
        for (const attribute of Object.keys(widget.attributes)) {
          if (!(attribute in bound)) {
            add(
              type.rendererFile,
              'warning',
              'renderer-binding',
              `Widget attribute ${attribute} is not bound - it stays empty`
            );
          }
        }
      }
    }
  }
  return findings;
}

function chainFindings(chain, map) {
  const findings = [];
  const add = (file, severity, rule, message) => findings.push({ file, severity, rule, message });
  const server = map.servers.find((s) => s.name === chain.server);
  const tool = server.tools.find((t) => t.name === chain.tool);
  const at = `Tool ${chain.tool}`;

  if (!chain.resource) {
    add(
      server.file,
      'error',
      'mcp-ui-resource',
      `${at}: uiResource "${tool.uiResource ?? ''}" matches no resourceName - the widget does not render`
    );
  } else if (!chain.envelope) {
    add(
      server.file,
      'error',
      'mcp-resource-uri',
      `${at}: resourceUri must be ui://widget/lightningType/c__<envelope type>, is ${chain.resource.uri}`
    );
  } else if (!map.types[chain.envelope]) {
    add(
      server.file,
      'error',
      'mcp-resource-uri',
      `${at}: resourceUri points to c__${chain.envelope}, which is not in this project`
    );
  } else if (!map.types[chain.envelope].rendererFile) {
    add(
      server.file,
      'error',
      'mcp-resource-uri',
      `${at}: c__${chain.envelope} has no renderer.json - point the resource at the envelope type`
    );
  }

  if (!ONE_REQUEST.test(tool.description)) {
    add(
      server.file,
      'warning',
      'mcp-one-request',
      `${at}: the description does not ask for exactly one request per call - bundled calls render as text only`
    );
  }
  if (tool.readOnly === undefined)
    add(server.file, 'info', 'mcp-hints', `${at}: no readOnly hint - clients cannot tell whether it changes data`);

  if (!chain.apexClass) {
    if (!/^aa:/.test(tool.apiIdentifier ?? ''))
      add(
        server.file,
        'info',
        'mcp-tool-class',
        `${at}: not an Apex action (${tool.apiIdentifier ?? 'no apiIdentifier'})`
      );
    return findings;
  }
  const classFile = map.classes[chain.apexClass];
  if (!classFile) {
    add(server.file, 'warning', 'mcp-tool-class', `${at}: Apex class ${chain.apexClass} is not in this project`);
    return findings;
  }
  const source = read(classFile);
  const code = apexCode(source);
  if (!/\bwith\s+sharing\b/i.test(code) && !/hxl-ignore\s+apex-sharing\s+--\s*\S/.test(source)) {
    add(
      classFile,
      'warning',
      'apex-sharing',
      `${chain.apexClass} is not "with sharing" - the tool may show what the user cannot see`
    );
  }
  if (/\[\s*SELECT\b|Database\.query/i.test(code) && !/USER_MODE|SECURITY_ENFORCED/i.test(code)) {
    add(
      classFile,
      'warning',
      'apex-user-mode',
      `${chain.apexClass} queries without WITH USER_MODE - field-level security is not enforced`
    );
  }
  if (!map.permissionSets.some((p) => p.classes.includes(chain.apexClass))) {
    add(
      classFile,
      'warning',
      'access-class',
      `No permission set grants ${chain.apexClass} - users without it see no tool`
    );
  }

  const response = map.types[chain.response];
  const invocable = invocableOutputs(source);
  if (response?.schema && invocable) {
    const outputs = new Set(invocable.outputs);
    const properties = new Set(Object.keys(response.properties));
    const invented = [...properties].filter((p) => !outputs.has(p));
    const omitted = [...outputs].filter((o) => !properties.has(o));
    if (invented.length || omitted.length) {
      add(
        response.schemaFile,
        'error',
        'type-response-outputs',
        `Not 1:1 with ${chain.apexClass}.${invocable.responseClass}: ${[
          invented.length && `not an output: ${invented.join(', ')}`,
          omitted.length && `missing: ${omitted.join(', ')}`
        ]
          .filter(Boolean)
          .join('; ')} - regenerate it from the describe`
      );
    }
  }
  return findings;
}

function orgFindings(map) {
  const findings = [];
  const add = (file, severity, rule, message) => findings.push({ file, severity, rule, message });
  if (Object.keys(map.widgets).length && !map.hxlSetting?.on && !map.scratchDefHxl) {
    add(
      map.root,
      'info',
      'hxl-setting',
      'Widgets without Settings:UiWidget (hxlEnabled) or a scratch definition that turns HXL on - turn it on before the deploy'
    );
  }
  for (const { file, name } of map.eca.apps) {
    if (!tag(read(file), 'contactEmail'))
      add(file, 'error', 'eca-contact', `External Client App ${name} has no contactEmail - the deploy fails`);
  }
  for (const { file } of map.eca.oauth) {
    const scopes = (tag(read(file), 'commaSeparatedOauthScopes') ?? '').split(',').map((s) => s.trim());
    if (map.servers.length && !scopes.includes('MCP'))
      add(file, 'error', 'eca-scope', 'OAuth scopes without MCP - clients cannot call the MCP server');
    if (map.servers.length && !scopes.includes('RefreshToken'))
      add(
        file,
        'warning',
        'eca-scope',
        'OAuth scopes without RefreshToken - clients must sign in again when the token expires'
      );
  }
  for (const { file } of map.eca.global) {
    const xml = read(file);
    if (tag(xml, 'isPkceRequired') !== 'true')
      add(file, 'warning', 'eca-pkce', 'isPkceRequired is not true - public MCP clients sign in with PKCE');
    if (!tag(xml, 'callbackUrl'))
      add(file, 'warning', 'eca-callback', 'No callbackUrl - add the callback URL of every client');
    if (tag(xml, 'consumerKey'))
      add(
        file,
        'warning',
        'eca-consumer-key',
        'consumerKey is committed - it is generated per org; keep it out of the project'
      );
  }
  if (map.servers.length && !map.eca.apps.length) {
    add(
      map.root,
      'info',
      'eca-missing',
      'MCP servers without an External Client App in the project - clients need one to sign in'
    );
  }
  return findings;
}

/** Ignore entries of .hxl-check-ignore: <rule> <path> -- <reason>. */
function ignoreEntries(map) {
  return read(map.ignoreFile)
    .split('\n')
    .map((line) => line.match(/^\s*([\w-]+)\s+(\S+)\s+--\s*\S/))
    .filter(Boolean)
    .map((m) => ({ rule: m[1], path: m[2] }));
}

function isSuppressed(finding, map, entries) {
  const rel = relative(map.root, finding.file);
  if (entries.some((e) => e.rule === finding.rule && (rel === e.path || rel.startsWith(e.path + sep)))) return true;
  if (!/\.(xml|cls)$/.test(finding.file)) return false;
  return new RegExp(`hxl-ignore\\s+${finding.rule}\\s+--\\s*\\S`).test(read(finding.file));
}

export function check(map, { errorsOnly = false } = {}) {
  const findings = [
    ...Object.values(map.widgets).flatMap(widgetFindings),
    ...Object.values(map.types).flatMap((type) => typeFindings(type, map)),
    ...map.chains.flatMap((chain) => chainFindings(chain, map)),
    ...orgFindings(map)
  ];
  const entries = ignoreEntries(map);
  return findings
    .filter((finding) => !isSuppressed(finding, map, entries))
    .filter((finding) => !errorsOnly || finding.severity === 'error');
}

// ----------------------------------------------------------------------- CLI

function printMap(map) {
  console.log(`HXL check of ${map.root}\n`);
  if (map.chains.length) {
    console.log('Tools');
    for (const c of map.chains) {
      console.log(
        `  ${c.server}/${c.tool}  →  ${c.apexClass ?? '?'}  →  ${c.envelope ?? '?'} (${c.response ?? '?'})  →  ${c.widget ?? '?'}`
      );
    }
    console.log('');
  }
  const loose = Object.keys(map.widgets).filter((w) => !map.chains.some((c) => c.widget === w));
  if (loose.length) console.log(`Widgets without a tool\n  ${loose.join(', ')}\n`);
  console.log(
    `Sign-in: ${map.eca.apps.map((a) => a.name).join(', ') || 'no External Client App'} · HXL setting: ${
      map.hxlSetting?.on ? 'on' : map.scratchDefHxl ? 'scratch definition' : 'not in the project'
    }\n`
  );
}

function printFindings(findings, root) {
  const counts = { error: 0, warning: 0, info: 0 };
  const byFile = new Map();
  for (const finding of findings) {
    counts[finding.severity]++;
    byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding]);
  }
  for (const [file, list] of byFile) {
    console.log(relative(root, file) || '.');
    list
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .forEach(({ severity, rule, message }) => console.log(`  ${severity.padEnd(7)}  ${rule.padEnd(22)}  ${message}`));
    console.log('');
  }
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  console.log(
    `${count(counts.error, 'error')}, ${count(counts.warning, 'warning')}, ${count(counts.info, 'info')} in ${count(byFile.size, 'file')}`
  );
}

function main(argv) {
  const options = ['--errors-only', '--json'];
  const unknown = argv.filter((arg) => arg.startsWith('--') && !options.includes(arg));
  if (unknown.length) {
    console.error(`Unknown option ${unknown[0]}. Usage: hxl-check.mjs [path] [--errors-only] [--json]`);
    process.exit(2);
  }
  const [path = '.'] = argv.filter((arg) => !arg.startsWith('--'));
  if (!existsSync(path)) {
    console.error(`No such file or folder: ${path}`);
    process.exit(2);
  }
  const map = discover(findRoot(path));
  const findings = check(map, { errorsOnly: argv.includes('--errors-only') });
  if (argv.includes('--json')) {
    const rel = (file) => relative(map.root, file);
    console.log(
      JSON.stringify(
        {
          root: map.root,
          tools: map.chains.map(({ serverFile, resource, ...c }) => ({ ...c, resource: resource?.uri })),
          widgets: Object.keys(map.widgets),
          types: Object.keys(map.types),
          findings: findings.map((f) => ({ ...f, file: rel(f.file) }))
        },
        null,
        2
      )
    );
  } else {
    printMap(map);
    if (!Object.keys(map.widgets).length && !map.servers.length) {
      console.log('No widgets or MCP server definitions found - is this the project root?\n');
    }
    printFindings(findings, map.root);
  }
  process.exitCode = findings.some((finding) => finding.severity === 'error') ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
