#!/usr/bin/env node
// Tech X-ray of a Salesforce Multi-Framework project: maps the surfaces - UI
// bundles with their framework and App Launcher app, host LWCs that frame apps
// with lightning-ui-embedding, trusted sites, message channels, LWR guests - and
// checks the seams between them for the mistakes that have one right answer:
// links that cannot launch a bundle, org-specific URLs in code, frames that
// cannot remount or hide their errors, messages to any origin, trusted sites
// wider than needed, bundle dependencies that would go into a deployment.
//
//   node xray.mjs [path] [--errors-only] [--json] [--mermaid]
//
// The project root is the nearest folder with sfdx-project.json above the path
// (default: the working directory), or the path itself for a guest app outside
// Salesforce. Errors break a surface or open it up, warnings are worth a look in
// every review, infos are hints. The exit code is 1 when there is an error.
//
// --json prints the map and the findings, --mermaid the map as a flowchart.
//
// A finding the team decided to keep is suppressed on its line or the line
// above - with a reason, or the suppression does not count:
//
//   // xray-ignore <rule> -- <reason>
//   <!-- xray-ignore <rule> -- <reason> -->

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIPPED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.sf',
  '.sfdx',
  '.localdevserver',
  '.angular',
  '.vitepress',
  'coverage',
  'dist',
  'build',
  'out-tsc',
  '__tests__',
  'e2e',
  'staticresources'
]);
const CODE_FILE = /\.(?:[cm]?js|jsx|tsx?|html)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
const PATTERNS = {
  1: 'Native Angular UI bundle',
  2: 'Native React UI bundle',
  3: 'Internally hosted microfrontend - the guest saves',
  4: 'Externally hosted microfrontend - the host saves'
};

// ---------------------------------------------------------------- source prep

const cache = new Map();
/** File contents, read once. */
function read(file) {
  if (!cache.has(file)) cache.set(file, readFileSync(file, 'utf8'));
  return cache.get(file);
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch {
    return null;
  }
}

/** Replaces comments with spaces, keeping strings and line breaks, so rules do not match commented-out code. */
function blankJsComments(source) {
  let out = '';
  let state = 'code';
  let quote = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') state = 'line';
      else if (char === '/' && next === '*') state = 'block';
      else if (char === '"' || char === "'" || char === '`') {
        state = 'string';
        quote = char;
      }
      out += state === 'line' || state === 'block' ? ' ' : char;
    } else if (state === 'string') {
      out += char;
      if (char === '\\') out += source[++i] ?? '';
      else if (char === quote) state = 'code';
    } else if (state === 'line') {
      if (char === '\n') state = 'code';
      out += char === '\n' ? '\n' : ' ';
    } else {
      if (char === '*' && next === '/') {
        out += '  ';
        i++;
        state = 'code';
      } else out += char === '\n' ? '\n' : ' ';
    }
  }
  return out;
}

const blankHtmlComments = (source) => source.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));

/** The file without comments. */
function codeOf(file) {
  if (file.endsWith('.html') || file.endsWith('.xml')) return blankHtmlComments(read(file));
  if (file.endsWith('.json')) return read(file);
  return blankJsComments(read(file));
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Line numbers of every match of a global pattern. */
function matchLines(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => ({ line: lineOf(text, match.index), match }));
}

const xmlValue = (xml, tag) => xml.match(new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`))?.[1] ?? null;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ------------------------------------------------------------------ discovery

/** The nearest folder with sfdx-project.json at or above the path, else the path. */
export function findRoot(path) {
  const start = resolve(path);
  let dir = existsSync(start) && statSync(start).isFile() ? dirname(start) : start;
  for (;;) {
    if (existsSync(join(dir, 'sfdx-project.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return existsSync(start) && statSync(start).isFile() ? dirname(start) : start;
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

const within = (file, dir) => file.startsWith(dir + sep);
const isLwcFile = (file) => basename(dirname(dirname(file))) === 'lwc';
const isWildcardSalesforceApp = (endpoint) => /^https:\/\/\*\.salesforce\.app\/?$/.test(endpoint);
const isLocal = (endpoint) => /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\b/.test(endpoint);

/** The surfaces of the project and how they are wired. */
export function discover(root) {
  const files = walk(root);
  const sfdx = readJson(join(root, 'sfdx-project.json'));
  const packageDirs = (sfdx?.packageDirectories ?? []).map((pkg) => resolve(root, pkg.path));
  const inPackage = (file) => packageDirs.some((dir) => within(file, dir));
  const ofType = (suffix) => files.filter((file) => file.endsWith(suffix));

  const apps = ofType('.app-meta.xml').map((file) => ({
    name: basename(file, '.app-meta.xml'),
    file,
    label: xmlValue(read(file), 'label'),
    uiBundle: xmlValue(read(file), 'uiBundle')
  }));

  const bundles = ofType('.uibundle-meta.xml').map((file) => {
    const dir = dirname(file);
    const name = basename(file, '.uibundle-meta.xml');
    const pkg = readJson(join(dir, 'package.json'));
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    const framework = deps['@angular/core'] ? 'Angular' : deps.react ? 'React' : deps.vue ? 'Vue' : 'unknown';
    const outputDir = readJson(join(dir, 'ui-bundle.json'))?.outputDir ?? 'dist';
    const sources = files.filter((f) => within(f, dir) && CODE_FILE.test(f) && !TEST_FILE.test(f));
    const app = apps.find((a) => a.uiBundle?.replace(/^\w+__/, '') === name);
    return {
      name,
      file,
      dir,
      label: xmlValue(read(file), 'masterLabel'),
      target: xmlValue(read(file), 'target'),
      framework,
      app: app?.name ?? null,
      dataSdk: Boolean(deps['@salesforce/platform-sdk']),
      embeddable: sources.some((f) => /['"`]@salesforce\/platform-sdk\/ui-embedding['"`]/.test(codeOf(f))),
      built: existsSync(join(dir, outputDir)),
      outputDir,
      sources
    };
  });

  const hosts = files
    .filter((file) => file.endsWith('.html') && isLwcFile(file) && /<lightning-ui-embedding\b/.test(codeOf(file)))
    .map((html) => {
      const dir = dirname(html);
      const scripts = files.filter((f) => dirname(f) === dir && /\.[jt]s$/.test(f));
      const script = scripts.map(codeOf).join('\n');
      const tags = [...codeOf(html).matchAll(/<lightning-ui-embedding\b[^>]*>/g)].map((m) => m[0]);
      return {
        name: basename(dir),
        dir,
        html,
        scripts,
        frames: tags.length,
        events: [...new Set(tags.flatMap((tag) => [...tag.matchAll(/\bon([a-z0-9_]+)\s*=/g)].map((m) => m[1])))],
        channels: [
          ...new Set([...script.matchAll(/@salesforce\/messageChannel\/(\w+?)(?:__c)?['"`]/g)].map((m) => m[1]))
        ],
        writes: /['"`]lightning\/(?:uiRecordApi|graphql)['"`]/.test(script),
        handlesErrors: script.includes('sf-embedding.component.error'),
        hasTests: existsSync(join(dir, '__tests__'))
      };
    });

  const sites = ofType('.cspTrustedSite-meta.xml').map((file) => {
    const xml = read(file);
    return {
      name: basename(file, '.cspTrustedSite-meta.xml'),
      file,
      endpoint: xmlValue(xml, 'endpointUrl') ?? '',
      active: xmlValue(xml, 'isActive') === 'true',
      frameSrc: xmlValue(xml, 'isApplicableToFrameSrc') === 'true',
      otherDirectives: [...xml.matchAll(/<isApplicableTo(\w+?)Src>\s*true\s*</g)]
        .map((m) => m[1])
        .filter((d) => d !== 'Frame'),
      inPackage: inPackage(file)
    };
  });

  const visibilities = ofType('.permissionset-meta.xml').flatMap((file) =>
    [...read(file).matchAll(/<applicationVisibilities>([\s\S]*?)<\/applicationVisibilities>/g)].map((m) => ({
      file,
      line: lineOf(read(file), m.index),
      application: xmlValue(m[1], 'application'),
      visible: xmlValue(m[1], 'visible') === 'true'
    }))
  );

  const channels = ofType('.messageChannel-meta.xml').map((file) => basename(file, '.messageChannel-meta.xml'));
  const lwrGuests = ofType('lwr.config.json').map((file) => dirname(file));
  const jestConfigs = files.filter((file) => /(?:^|[\\/])jest\.config\.[cm]?[jt]s$/.test(file));
  // The Salesforce CLI reads only the root .forceignore - not the one the templates put in each bundle
  const forceignoreFile = join(root, '.forceignore');
  const forceignore = existsSync(forceignoreFile) ? { file: forceignoreFile, text: read(forceignoreFile) } : null;

  return {
    root,
    files,
    packageDirs,
    apps,
    bundles,
    hosts,
    sites,
    visibilities,
    channels,
    lwrGuests,
    jestConfigs,
    forceignore
  };
}

/** The integration patterns the project uses, in the numbering of Polyglot Arcade. */
export function patternsOf(map) {
  const found = [];
  for (const bundle of map.bundles) {
    if (bundle.framework === 'Angular') found.push({ no: 1, what: bundle.name });
    else if (bundle.framework === 'React') found.push({ no: 2, what: bundle.name });
  }
  const hostNames = map.hosts.map((host) => host.name).join(', ');
  if (map.hosts.length) {
    for (const bundle of map.bundles.filter((b) => b.embeddable)) {
      found.push({ no: 3, what: `${bundle.name} framed by ${hostNames}` });
    }
    for (const site of map.sites.filter((s) => s.active && s.frameSrc && s.inPackage)) {
      if (!isWildcardSalesforceApp(site.endpoint) && !isLocal(site.endpoint)) {
        found.push({ no: 4, what: `${site.endpoint} framed by ${hostNames}` });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------- rules
//
// File rules read one file without its comments and return the lines they
// object to. `ctx` knows the map: which bundle a file belongs to, whether it is
// part of an LWR app, the names of the bundles' apps.

const fileRules = [
  // -------- errors: broken or open in every org
  {
    id: 'org-relative-bundle-url',
    severity: 'error',
    message:
      'An org-relative /lightning/app/ URL does not launch a UI bundle - it opens an empty Lightning app. Use the bundle URL (the StartUrl of its AppMenuItem), stored on a configuration record by the setup.',
    applies: (file) => CODE_FILE.test(file),
    check: ({ code, ctx }) => (ctx.bundleAppPattern ? matchLines(code, ctx.bundleAppPattern) : [])
  },
  {
    id: 'hardcoded-bundle-url',
    severity: 'error',
    message:
      'A *.salesforce.app URL belongs to one org. Read it at run time - SFDC_ENV for the own bundle, a configuration record written by the connect step for the others.',
    applies: (file) => CODE_FILE.test(file) || (file.endsWith('.json') && basename(dirname(file)) === 'data'),
    check: ({ code }) => matchLines(code, /https?:\/\/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.salesforce\.app\b/g)
  },
  {
    id: 'postmessage-any-origin',
    severity: 'error',
    message:
      "postMessage to '*' hands the message to whatever page frames or is framed. Send it to the one origin you trust - hostAppOrigin from hostMetaData in a guest.",
    applies: (file) => /\.[cm]?[jt]sx?$/.test(file),
    check: ({ code }) => matchLines(code, /\.postMessage\s*\([^;]{0,400}?,\s*(['"`])\*\1\s*[,)]/g)
  },
  {
    id: 'sdk-in-lwr',
    severity: 'error',
    message:
      'LWR, the runtime of LWC OSS, cannot load @salesforce/platform-sdk. Implement the guest side of the package-free bridge instead.',
    applies: (file, ctx) => /\.[cm]?[jt]sx?$/.test(file) && ctx.isLwr(file),
    check: ({ code }) => matchLines(code, /['"`]@salesforce\/platform-sdk(?:\/[\w-]+)?['"`]/g)
  },

  // -------- warnings: works in one place, breaks in another
  {
    id: 'message-origin-check',
    severity: 'warning',
    message:
      'Listens to window messages but never checks event.origin - any page that frames or is framed can talk to it. Check the origin, and the source, before reading the data.',
    applies: (file) => /\.[cm]?[jt]sx?$/.test(file),
    check: ({ code }) =>
      code.includes('.origin')
        ? []
        : matchLines(code, /\baddEventListener\s*\(\s*['"`]message['"`]/g).filter(
            ({ match }) => !/port\s*\.\s*$/i.test(code.slice(Math.max(0, match.index - 40), match.index))
          )
  },
  {
    id: 'lightning-link-without-app',
    severity: 'warning',
    message:
      'A /lightning/n/ or /lightning/r/ link without its app opens in whatever Lightning app the user used last. Link through /lightning/app/<namespace>__<app>/n/<tab> or .../r/<Object>/<id>/view.',
    applies: (file, ctx) => Boolean(ctx.bundleOf(file)) && CODE_FILE.test(file),
    check: ({ code }) =>
      matchLines(code, /\/lightning\/[nro]\//g).filter(
        ({ match }) => !/\/lightning\/app\/[^'"`\s]*$/.test(code.slice(Math.max(0, match.index - 120), match.index))
      )
  },
  {
    id: 'api-version-literal',
    severity: 'warning',
    message:
      'An API version written into a URL goes stale with the next release. Use the Data SDK, or the __SF_API_VERSION__ the build plugin injects.',
    applies: (file, ctx) => Boolean(ctx.bundleOf(file)) && CODE_FILE.test(file),
    check: ({ code }) => matchLines(code, /\/services\/data\/v\d+\.\d+/g)
  },
  {
    id: 'embed-remount',
    severity: 'warning',
    message:
      'src and sandbox are bound to the frame at mount - a new value raises SESSION_BINDING_MUTATED. Render the frame in a for:each keyed by its src (or behind lwc:if) so a new URL mounts a new frame.',
    applies: (file, ctx) => ctx.isHostHtml(file),
    check: ({ code }) =>
      matchLines(code, /<lightning-ui-embedding\b[^>]*>/g).filter(
        ({ match }) => /\bsrc\s*=\s*\{/.test(match[0]) && !/\bkey\s*=/.test(match[0])
      )
  },

  // -------- infos: decide it on purpose
  {
    id: 'embed-sandbox',
    severity: 'info',
    message:
      'No sandbox attribute - the frame runs with the default tokens. Set the tokens the guest needs explicitly; the embedding guide lists the defaults of the release.',
    applies: (file, ctx) => ctx.isHostHtml(file),
    check: ({ code }) =>
      matchLines(code, /<lightning-ui-embedding\b[^>]*>/g).filter(({ match }) => !/\bsandbox\s*=/.test(match[0]))
  }
];

/** Findings that need more than one file - frames, bundles, trusted sites, permission sets. */
function projectFindings(map) {
  const findings = [];
  const add = (file, line, severity, rule, message) => findings.push({ file, line, severity, rule, message });
  const framingSites = map.sites.filter((site) => site.active && site.frameSrc && site.inPackage);

  for (const host of map.hosts) {
    const file = host.scripts[0] ?? host.html;
    if (!host.handlesErrors) {
      add(
        file,
        0,
        'warning',
        'embed-error-unhandled',
        `${host.name} never listens to sf-embedding.component.error - a frame that fails stays blank without a word. Add the listener in renderedCallback and show code and message.`
      );
    }
    if (host.hasTests && map.jestConfigs.length && !map.jestConfigs.some((cfg) => /uiEmbedding/.test(read(cfg)))) {
      add(
        map.jestConfigs[0],
        0,
        'warning',
        'jest-embedding-stub',
        `${host.name} has Jest tests, but no jest config maps lightning/uiEmbedding to a stub - sfdx-lwc-jest does not ship one, so the tests cannot load the host.`
      );
    }
  }

  if (map.hosts.length && framingSites.length === 0) {
    add(
      map.hosts[0].html,
      0,
      'error',
      'embed-no-csp',
      'Frames apps, but the package directories hold no active CSP Trusted Site for frame-src - Lightning blocks every frame. Add one per guest origin, frame-src only.'
    );
  } else if (
    map.hosts.length &&
    map.bundles.some((b) => b.embeddable) &&
    !framingSites.some((site) => isWildcardSalesforceApp(site.endpoint))
  ) {
    add(
      map.hosts[0].html,
      0,
      'warning',
      'csp-internal-frame',
      'A UI bundle is built to be framed, but no active trusted site allows frame-src for https://*.salesforce.app - internally hosted bundles stay blank.'
    );
  }

  for (const bundle of map.bundles) {
    if (!bundle.embeddable) {
      const user = bundle.sources.find((f) => /\b(?:getViewSDK|createViewSDK)\s*\(/.test(codeOf(f)));
      if (user) {
        const [{ line }] = matchLines(codeOf(user), /\b(?:getViewSDK|createViewSDK)\s*\(/g);
        add(
          user,
          line,
          'warning',
          'embed-bootstrap',
          `${bundle.name} uses the View SDK but never imports @salesforce/platform-sdk/ui-embedding - without the bootstrap the frame gets no handshake. Import it in the embed route before the first view SDK call.`
        );
      }
    }
    // The reactbasic template leaves target out; such a bundle still launches as an App Launcher app
    if ((bundle.target ?? 'CustomApplication') === 'CustomApplication' && !bundle.app) {
      add(
        bundle.file,
        0,
        'warning',
        'bundle-no-app',
        `No Custom Application points at ${bundle.name} (<uiBundle>c__${bundle.name}</uiBundle>) - it has no App Launcher entry and cannot be launched.`
      );
    }
    if (!bundle.built) {
      add(
        bundle.file,
        0,
        'info',
        'bundle-not-built',
        `${bundle.outputDir}/ does not exist - the bundle is deployed with its build output, so run npm ci and npm run build in it before every deploy.`
      );
    }
  }

  const ignoresNodeModules = (map.forceignore?.text ?? '')
    .split('\n')
    .some((line) => !line.trim().startsWith('#') && !line.trim().startsWith('!') && /node_modules/.test(line));
  if (map.bundles.length && !ignoresNodeModules) {
    add(
      map.forceignore?.file ?? join(map.root, 'sfdx-project.json'),
      0,
      'warning',
      'forceignore-node-modules',
      `The root .forceignore does not exclude the bundles' node_modules - the Salesforce CLI ignores the .forceignore inside a bundle, so a deploy of the whole package directory uploads them and fails ("fetch failed"). Add **/uiBundles/*/node_modules/** to the root .forceignore.`
    );
  }

  const bundleApps = new Set(map.bundles.map((b) => b.app).filter(Boolean));
  for (const visibility of map.visibilities) {
    if (bundleApps.has(visibility.application) && !visibility.visible) {
      add(
        visibility.file,
        visibility.line,
        'warning',
        'app-hidden',
        `${visibility.application} is not visible - for a UI bundle app that removes the access, not just the App Launcher entry. Keep it visible and redirect to the entry point instead.`
      );
    }
  }

  for (const site of map.sites) {
    const line = lineOf(read(site.file), read(site.file).indexOf('<endpointUrl>'));
    const host = site.endpoint.replace(/^\w+:\/\//, '').split(/[/:]/)[0];
    if (host === '*' || /^\*\.[^.]+$/.test(host)) {
      add(
        site.file,
        line,
        'error',
        'csp-wildcard',
        `${site.endpoint} trusts every site - name the origin of the guest.`
      );
    } else if (host.startsWith('*.') && !isWildcardSalesforceApp(site.endpoint)) {
      add(
        site.file,
        line,
        'warning',
        'csp-wildcard',
        `${site.endpoint} trusts every site on that domain, including other people's. Name the guest's exact origin.`
      );
    }
    if (site.inPackage && isLocal(site.endpoint)) {
      add(
        site.file,
        line,
        'warning',
        'dev-site-in-package',
        `${site.endpoint} is a development-only site in a package directory - it reaches every org the project deploys to. Move it to a folder outside the package directories and deploy it on purpose.`
      );
    }
    if (site.frameSrc && site.otherDirectives.length) {
      add(
        site.file,
        line,
        'info',
        'csp-extra-directives',
        `Also allows ${site.otherDirectives.join(', ').toLowerCase()}-src. A site that is only framed needs frame-src alone.`
      );
    }
  }
  return findings;
}

/** Every finding of the project, without the suppressed ones. */
export function check(map, { errorsOnly = false } = {}) {
  const lwrDirs = map.lwrGuests;
  const hostHtml = new Set(map.hosts.map((h) => h.html));
  const appNames = [...new Set(map.bundles.flatMap((b) => [b.app, b.name]).filter(Boolean))];
  const ctx = {
    bundleOf: (file) => map.bundles.find((b) => within(file, b.dir)),
    isLwr: (file) => lwrDirs.some((dir) => within(file, dir)),
    isHostHtml: (file) => hostHtml.has(file),
    bundleAppPattern: appNames.length
      ? new RegExp(`/lightning/app/(?:\\w+__)?(?:${appNames.map(escapeRegExp).join('|')})(?![\\w])`, 'g')
      : null
  };

  const findings = [];
  for (const file of map.files) {
    if (TEST_FILE.test(file)) continue;
    for (const rule of fileRules) {
      if (!rule.applies(file, ctx)) continue;
      for (const { line } of rule.check({ code: codeOf(file), file, ctx })) {
        findings.push({ file, line, severity: rule.severity, rule: rule.id, message: rule.message });
      }
    }
  }
  findings.push(...projectFindings(map));

  return findings
    .filter((finding) => !isSuppressed(finding))
    .filter((finding) => !errorsOnly || finding.severity === 'error');
}

/** A finding the team kept, with a reason, on its line or the line above. */
function isSuppressed({ file, line, rule }) {
  if (!line) return false;
  const lines = read(file).split('\n');
  const marker = new RegExp(`xray-ignore\\s+${escapeRegExp(rule)}\\s+--\\s*\\S`);
  return [lines[line - 1], lines[line - 2]].some((text) => text !== undefined && marker.test(text));
}

// ----------------------------------------------------------------------- CLI

function printMap(map) {
  const rel = (file) => relative(map.root, file) || '.';
  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(title);
    rows.forEach((row) => console.log(`  ${row}`));
    console.log('');
  };
  console.log(`Multi-Framework X-ray of ${map.root}\n`);
  section(
    'UI bundles',
    map.bundles.map(
      (b) =>
        `${b.name.padEnd(28)} ${b.framework.padEnd(8)} ${[
          b.app ? `app ${b.app}` : 'no app',
          b.dataSdk ? 'Data SDK' : null,
          b.embeddable ? 'embeddable' : null,
          b.built ? 'built' : 'not built'
        ]
          .filter(Boolean)
          .join(' · ')}`
    )
  );
  section(
    'Lightning apps',
    map.apps.filter((a) => !a.uiBundle).map((a) => `${a.name.padEnd(28)} ${a.label ?? ''}`)
  );
  section(
    'Host LWCs',
    map.hosts.map(
      (h) =>
        `${h.name.padEnd(28)} ${[
          `${h.frames} frame${h.frames === 1 ? '' : 's'}`,
          h.events.length ? `events ${h.events.join(', ')}` : null,
          h.channels.length ? `publishes ${h.channels.join(', ')}` : null,
          h.writes ? 'writes records' : null
        ]
          .filter(Boolean)
          .join(' · ')}`
    )
  );
  section(
    'Trusted sites for frames',
    map.sites
      .filter((s) => s.frameSrc)
      .map(
        (s) =>
          `${s.name.padEnd(28)} ${s.endpoint}${s.active ? '' : ' (inactive)'}${s.inPackage ? '' : ' (outside the package directories)'}`
      )
  );
  section('Message channels', map.channels);
  section(
    'LWR guests',
    map.lwrGuests.map((dir) => rel(dir))
  );
  section(
    'Integration patterns',
    patternsOf(map)
      .sort((a, b) => a.no - b.no)
      .map((p) => `${p.no}  ${PATTERNS[p.no].padEnd(52)} ${p.what}`)
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
    console.log(relative(root, file) || file);
    list
      .sort((a, b) => a.line - b.line || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .forEach(({ line, severity, rule, message }) =>
        console.log(`  ${String(line || '-').padStart(4)}  ${severity.padEnd(7)}  ${rule.padEnd(26)}  ${message}`)
      );
    console.log('');
  }
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  console.log(
    `${count(counts.error, 'error')}, ${count(counts.warning, 'warning')}, ${count(counts.info, 'info')} in ${count(byFile.size, 'file')}`
  );
}

/** The map as a Mermaid flowchart, in the colors of Polyglot Arcade. */
export function mermaid(map) {
  const id = (prefix, name) => `${prefix}_${name.replace(/[^A-Za-z0-9]/g, '_')}`;
  const lines = ['flowchart LR', '    subgraph Org["Salesforce org"]', '        direction LR'];
  for (const b of map.bundles)
    lines.push(`        ${id('bundle', b.name)}["<b>${b.label ?? b.name}</b><br/>${b.framework} UI bundle"]`);
  for (const h of map.hosts) lines.push(`        ${id('host', h.name)}["<b>${h.name}</b><br/>host LWC"]`);
  lines.push('        Data[("Salesforce data")]', '    end');
  const guests = map.hosts.length
    ? map.sites.filter(
        (s) => s.active && s.frameSrc && s.inPackage && !isWildcardSalesforceApp(s.endpoint) && !isLocal(s.endpoint)
      )
    : [];
  for (const g of guests)
    lines.push(`    ${id('guest', g.name)}["<b>${g.endpoint.replace(/^https?:\/\//, '')}</b><br/>external app"]`);
  for (const b of map.bundles.filter((b) => b.dataSdk))
    lines.push(`    ${id('bundle', b.name)} -- "Data SDK GraphQL" --> Data`);
  for (const h of map.hosts) {
    for (const b of map.bundles.filter((b) => b.embeddable))
      lines.push(`    ${id('host', h.name)} -- "frames · props, events" --> ${id('bundle', b.name)}`);
    for (const g of guests)
      lines.push(`    ${id('host', h.name)} -- "frames · props, events" --> ${id('guest', g.name)}`);
    if (h.writes) lines.push(`    ${id('host', h.name)} -- "LDS · GraphQL wire" --> Data`);
  }
  lines.push(
    '    classDef angular fill:#e879f9,stroke:#a21caf,color:#1a0520',
    '    classDef react fill:#22d3ee,stroke:#0e7490,color:#042f2e',
    '    classDef floor fill:#60a5fa,stroke:#1d4ed8,color:#0b1530',
    '    classDef guest fill:#c084fc,stroke:#7e22ce,color:#1e0b36'
  );
  const classOf = (names, cls) => names.length && lines.push(`    class ${names.join(',')} ${cls}`);
  classOf(
    map.bundles.filter((b) => b.framework === 'Angular').map((b) => id('bundle', b.name)),
    'angular'
  );
  classOf(
    map.bundles.filter((b) => b.framework !== 'Angular').map((b) => id('bundle', b.name)),
    'react'
  );
  classOf(
    map.hosts.map((h) => id('host', h.name)),
    'floor'
  );
  classOf(
    guests.map((g) => id('guest', g.name)),
    'guest'
  );
  return lines.join('\n');
}

function main(argv) {
  const options = ['--errors-only', '--json', '--mermaid'];
  const unknown = argv.filter((arg) => arg.startsWith('--') && !options.includes(arg));
  if (unknown.length) {
    console.error(`Unknown option ${unknown[0]}. Usage: xray.mjs [path] [--errors-only] [--json] [--mermaid]`);
    process.exit(2);
  }
  const [path = '.'] = argv.filter((arg) => !arg.startsWith('--'));
  if (!existsSync(path)) {
    console.error(`No such file or folder: ${path}`);
    process.exit(2);
  }
  const map = discover(findRoot(path));
  const findings = check(map, { errorsOnly: argv.includes('--errors-only') });

  if (argv.includes('--mermaid')) console.log(mermaid(map));
  else if (argv.includes('--json')) {
    const rel = (file) => relative(map.root, file);
    console.log(
      JSON.stringify(
        {
          root: map.root,
          bundles: map.bundles.map(({ sources, file, dir, ...b }) => ({ ...b, path: rel(dir) })),
          apps: map.apps.map(({ file, ...a }) => a),
          hosts: map.hosts.map(({ scripts, html, dir, ...h }) => ({ ...h, path: rel(dir) })),
          trustedSites: map.sites.map(({ file, ...s }) => s),
          channels: map.channels,
          lwrGuests: map.lwrGuests.map(rel),
          patterns: patternsOf(map).map((p) => ({ ...p, name: PATTERNS[p.no] })),
          findings: findings.map((f) => ({ ...f, file: rel(f.file) }))
        },
        null,
        2
      )
    );
  } else {
    printMap(map);
    if (!map.bundles.length && !map.hosts.length && !map.lwrGuests.length) {
      console.log('No UI bundles, host LWCs or LWR guests found - is this the project root?\n');
    }
    printFindings(findings, map.root);
  }
  process.exitCode = findings.some((finding) => finding.severity === 'error') ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
