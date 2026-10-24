#!/usr/bin/env node
// Checks Lightning web component bundles for the anti-patterns that have one
// right answer - APIs that Lightning Web Security blocks or that open the door
// to cross-site scripting, listeners and timers that outlive the component,
// deprecated directives, styling that SLDS 2 does not support - so a review
// starts from facts and a guardrail does not depend on anyone remembering it.
//
//   node lwc-check.mjs [path...] [--errors-only] [--json]
//   node lwc-check.mjs --hook < event.json
//
// A path is a file, a component folder or any folder above; without a path the
// working directory is searched. Only files inside an `lwc` folder count.
// Errors break or endanger the component, warnings are worth a look in every
// review, infos are hints. The exit code is 1 when there is an error.
//
// --hook reads a Claude Code PostToolUse event on stdin, checks the file the
// tool wrote for errors and answers with a block decision that hands them back
// to the agent. Outside an lwc folder it prints nothing.
//
// A finding the team decided to keep is suppressed on its line or the line
// above - with a reason, or the suppression does not count:
//
//   // lwc-check-ignore <rule> -- <reason>
//   <!-- lwc-check-ignore <rule> -- <reason> -->
//   /* lwc-check-ignore <rule> -- <reason> */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const SKIPPED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.sf',
  '.sfdx',
  '.localdevserver',
  'staticresources',
  'coverage'
]);
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

// ---------------------------------------------------------------- source prep

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

/** Replaces every match of a comment pattern with spaces, keeping line breaks. */
function blankPattern(source, pattern) {
  return source.replace(pattern, (comment) => comment.replace(/[^\n]/g, ' '));
}

const blankHtmlComments = (source) => blankPattern(source, /<!--[\s\S]*?-->/g);
const blankCssComments = (source) => blankPattern(source, /\/\*[\s\S]*?\*\//g);

/** Removes var(...) expressions, nested ones included, so fallback values are not judged on their own. */
function withoutVarCalls(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('var(', i)) {
      let depth = 0;
      for (; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) break;
      }
    } else out += text[i];
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Line numbers of every match of a global pattern. */
function matchLines(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => ({ line: lineOf(text, match.index), match }));
}

// ---------------------------------------------------------------------- rules
//
// Each rule names the file kind it reads and returns the lines it objects to.
// `code` is the file without comments; `bundle` gives access to the other files
// of the component folder.

const rules = [
  // -------- errors: blocked, unsafe or broken at run time
  {
    id: 'no-eval',
    kind: 'js',
    severity: 'error',
    message:
      'Evaluates a string as code - Lightning Web Security only sandboxes it, so it stays an injection risk. Use explicit logic or a lookup table.',
    check: ({ code }) =>
      matchLines(code, /(?<![\w$.])eval\s*\(|\bnew\s+Function\s*\(|\bset(?:Timeout|Interval)\s*\(\s*['"`]/g)
  },
  {
    id: 'no-unsafe-html',
    kind: 'js',
    severity: 'error',
    message:
      "Writes an HTML string into the DOM - Lightning Web Security does not sanitize inside the component's own shadow tree, so this is a cross-site scripting sink. Render it with the template, or with lightning-formatted-rich-text for trusted rich text.",
    check: ({ code }) =>
      matchLines(code, /\.(?:innerHTML|outerHTML)\s*(?:\+?=)(?!=)(?!\s*(['"`])\1\s*[;)\n])|\.insertAdjacentHTML\s*\(/g)
  },
  {
    id: 'no-blocked-api',
    kind: 'js',
    severity: 'error',
    message: 'Blocked by Lightning Web Security - it throws at run time.',
    check: ({ code }) =>
      matchLines(
        code,
        /\bdocument\s*\.\s*write(?:ln)?\s*\(|\bnew\s+(?:Shared)?Worker\s*\(|\bnavigator\s*\.\s*serviceWorker\b|\b(?:parseHTMLUnsafe|setHTMLUnsafe)\s*\(/g
      )
  },
  {
    id: 'no-legacy-global',
    kind: 'js',
    severity: 'error',
    message:
      'Aura or legacy global - it does not exist in a Lightning web component. Use the LWC module instead (@salesforce/user/Id, lightning/uiRecordApi, lightning/navigation, ...).',
    check: ({ code }) => matchLines(code, /(?<![\w$.])(?:\$A|sforce|Sfdc)\s*\./g)
  },
  {
    id: 'no-external-script',
    kind: 'js',
    severity: 'error',
    message:
      "The org's Content Security Policy blocks code from other hosts, and a CDN can change it under you. Upload the library as a static resource and load it from @salesforce/resourceUrl.",
    check: ({ code }) => matchLines(code, /\bload(?:Script|Style)\s*\(\s*this\s*,\s*['"`]https?:/g)
  },
  {
    id: 'no-external-script',
    kind: 'html',
    severity: 'error',
    message:
      'Templates cannot run scripts. Load a library as a static resource with loadScript from lightning/platformResourceLoader.',
    check: ({ code }) => matchLines(code, /<script\b/gi)
  },
  {
    id: 'no-framework-endpoint',
    kind: 'js',
    severity: 'error',
    message: 'Calls an internal framework endpoint, which Lightning Web Security blocks. Call an Apex method instead.',
    check: ({ code }) => matchLines(code, /\b(?:fetch|open)\s*\(\s*['"`][^'"`]*\/(?:aura|webruntime)\b/g)
  },

  // -------- warnings: works today, breaks or misleads tomorrow
  {
    id: 'no-document-query',
    kind: 'js',
    severity: 'warning',
    message:
      "Searches the whole page instead of the component's own template. Use this.template.querySelector, or better lwc:ref.",
    check: ({ code }) =>
      matchLines(code, /\bdocument\s*\.\s*(?:querySelector(?:All)?|getElementById|getElementsBy\w+)\s*\(/g)
  },
  {
    id: 'listener-cleanup',
    kind: 'js',
    severity: 'warning',
    message:
      'Listener on window or document that is never removed - it keeps the component alive after it is gone. Add it in connectedCallback and remove it in disconnectedCallback, with the handler stored as a class field.',
    check: ({ code }) =>
      matchLines(code, /\b(window|document|globalThis)\s*\.\s*addEventListener\s*\(\s*['"`](\w+)/g).filter(
        ({ match }) =>
          !new RegExp(`\\b${match[1]}\\s*\\.\\s*removeEventListener\\s*\\(\\s*['"\`]${match[2]}['"\`]`).test(code)
      )
  },
  {
    id: 'bind-in-listener',
    kind: 'js',
    severity: 'warning',
    message:
      'bind() creates a new function on every call, so removeEventListener can never remove this listener. Use an arrow function class field.',
    check: ({ code }) => matchLines(code, /addEventListener\s*\([^;]*?\.bind\s*\(/g)
  },
  {
    id: 'resource-cleanup',
    kind: 'js',
    severity: 'warning',
    message:
      'Started but never stopped - it keeps running after the component is removed. Stop it in disconnectedCallback.',
    check: ({ code }) =>
      [
        [/\bsetInterval\s*\(/g, /\bclearInterval\s*\(/],
        [/\brequestAnimationFrame\s*\(/g, /\bcancelAnimationFrame\s*\(/],
        [/\bnew\s+(?:Resize|Mutation|Intersection)Observer\s*\(/g, /\.disconnect\s*\(/],
        [/\bgetUserMedia\s*\(/g, /\.stop\s*\(/],
        [/(?<![\w$.])subscribe\s*\(/g, /(?<![\w$.])unsubscribe\s*\(/]
      ].flatMap(([start, stop]) => (stop.test(code) ? [] : matchLines(code, start)))
  },
  {
    id: 'event-name',
    kind: 'js',
    severity: 'warning',
    message:
      'Event names are lowercase letters, digits and underscores, without an "on" prefix - otherwise the parent cannot listen to them in its template.',
    check: ({ code }) =>
      matchLines(code, /\bnew\s+CustomEvent\s*\(\s*['"`]([^'"`]+)['"`]/g).filter(
        ({ match }) => !/^[a-z][a-z0-9_]*$/.test(match[1]) || /^on/.test(match[1])
      )
  },
  {
    id: 'event-composed',
    kind: 'js',
    severity: 'warning',
    message:
      "composed: true sends the event through every shadow boundary up to the document - it becomes part of every ancestor's API. Use it only when a component outside the owner's template must hear it.",
    check: ({ code }) => matchLines(code, /\bcomposed\s*:\s*true\b/g)
  },
  {
    id: 'event-base',
    kind: 'js',
    severity: 'warning',
    message: 'Event cannot carry data. Use CustomEvent with a detail object.',
    check: ({ code }) => matchLines(code, /\bnew\s+Event\s*\(/g)
  },
  {
    id: 'no-pubsub',
    kind: 'js',
    severity: 'warning',
    message:
      'The pubsub module is deprecated and works on one page only. Use Lightning Message Service (lightning/messageService).',
    check: ({ code }) => matchLines(code, /from\s+['"]c\/pubsub['"]/g)
  },
  {
    id: 'schema-import',
    kind: 'js',
    severity: 'warning',
    message:
      'Field names as strings are not checked when the component is deployed, so a renamed field breaks it silently. Import fields from @salesforce/schema.',
    check: ({ code }) =>
      matchLines(
        code,
        /\b(?:optionalFields|fields)\s*:\s*\[\s*['"`]\w+\.\w+|\bgetField(?:Display)?Value\s*\([^,)]+,\s*['"`]/g
      )
  },
  {
    id: 'track-primitive',
    kind: 'js',
    severity: 'warning',
    message:
      '@track is not needed here - every field is reactive. It only matters for changes inside an object or array that is mutated in place.',
    check: ({ code }) => matchLines(code, /@track\s+\w+\s*=\s*(?:['"`\d-]|true\b|false\b|null\b|undefined\b)/g)
  },
  {
    id: 'api-reassign',
    kind: 'js',
    severity: 'warning',
    message:
      'The parent owns @api properties - reassigning one breaks the one-way data flow. Keep a private copy, or use a getter and setter, and tell the parent with an event.',
    check: ({ code }) => {
      const names = [...code.matchAll(/@api\s+(?!get\b|set\b|async\b|static\b)(\w+)\s*(?:=|;|\n)/g)].map((m) => m[1]);
      return names.flatMap((name) => matchLines(code, new RegExp(`\\bthis\\.${name}\\s*(?:[-+*/]?=)(?!=)`, 'g')));
    }
  },
  {
    id: 'native-dialog',
    kind: 'js',
    severity: 'warning',
    message:
      'Browsers block native dialogs in cross-origin frames, and they do not look like Lightning. Use LightningAlert, LightningConfirm or LightningPrompt.',
    check: ({ code }) =>
      matchLines(code, /(?<![\w$.])(?:(?:window|globalThis)\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/g).filter(
        ({ line }) => !/^\s*(?:async\s+)?(?:alert|confirm|prompt)\s*\([^)]*\)\s*\{/.test(code.split('\n')[line - 1])
      )
  },
  {
    id: 'no-console',
    kind: 'js',
    severity: 'warning',
    message: 'Debug output left in. Remove it, or report the problem to the user with a toast or an error state.',
    check: ({ code }) => matchLines(code, /\bconsole\s*\.\s*(?:log|debug|info|trace|dir)\s*\(/g)
  },
  {
    id: 'hardcoded-id',
    kind: 'js',
    severity: 'warning',
    message:
      'Looks like a record id - ids differ between orgs and after every sandbox refresh. Query or receive the id.',
    check: ({ code }) =>
      matchLines(code, /['"`]((?:0|a)[0-9A-Za-z]{14}(?:[0-9A-Za-z]{3})?)['"`]/g).filter(
        ({ match }) => (match[1].match(/\d/g) ?? []).length >= 4
      )
  },
  {
    id: 'hardcoded-url',
    kind: 'js',
    severity: 'warning',
    message:
      'The URL of one org - it breaks in every sandbox. Use relative paths or NavigationMixin, and Named Credentials for callouts.',
    check: ({ code }) => matchLines(code, /\b[\w-]+\.(?:my\.salesforce\.com|lightning\.force\.com|my\.site\.com)\b/g)
  },
  {
    id: 'navigation',
    kind: 'js',
    severity: 'warning',
    message:
      'Builds the navigation by hand - URLs differ between Lightning Experience, the mobile app and Experience Cloud. Use NavigationMixin from lightning/navigation.',
    check: ({ code }) =>
      matchLines(code, /\b(?:window|globalThis)\s*\.\s*location\s*(?:\.\s*(?:href|assign|replace)\b|\s*=(?!=))/g)
  },
  {
    id: 'manual-dom',
    kind: 'js',
    severity: 'warning',
    message:
      'Inserts nodes by hand, but no element in the template has lwc:dom="manual" - the engine may throw or overwrite them on the next render.',
    check: ({ code, bundle }) =>
      bundle.html.some((html) => /lwc:dom\s*=\s*["']manual["']/.test(html))
        ? []
        : matchLines(code, /\.(?:appendChild|insertBefore|replaceChildren|prepend)\s*\(/g)
  },
  {
    id: 'legacy-directive',
    kind: 'html',
    severity: 'warning',
    message: 'if:true and if:false are deprecated. Use lwc:if, lwc:elseif and lwc:else.',
    check: ({ code }) => matchLines(code, /\bif:(?:true|false)\s*=/g)
  },
  {
    id: 'index-key',
    kind: 'html',
    severity: 'warning',
    message:
      'The list index as key makes the engine reuse the wrong rows when the list changes. Use a unique value from the item.',
    check: ({ code }) => {
      const indexes = [...code.matchAll(/for:index\s*=\s*["'](\w+)["']/g)].map((m) => m[1]);
      return indexes.flatMap((name) => matchLines(code, new RegExp(`\\bkey\\s*=\\s*\\{\\s*${name}\\s*\\}`, 'g')));
    }
  },
  {
    id: 'img-alt',
    kind: 'html',
    severity: 'warning',
    message: 'Image without alt text. Describe it, or use alt="" if it is decorative.',
    check: ({ code }) => matchLines(code, /<img\b(?![^>]*\balt\s*=)[^>]*>/gi)
  },
  {
    id: 'icon-button-label',
    kind: 'html',
    severity: 'warning',
    message: 'Icon-only button without alternative-text - a screen reader announces it as "button".',
    check: ({ code }) =>
      matchLines(code, /<lightning-button-icon(?:-stateful)?\b(?![^>]*\balternative-text\s*=)[^>]*>/gi)
  },
  {
    id: 'click-only',
    kind: 'html',
    severity: 'warning',
    message:
      'Only reachable with a mouse. Use a button (or lightning-button), or an a with href - or add a role, tabindex="0" and a key handler.',
    check: ({ code }) =>
      matchLines(code, /<(div|span|li|td|img|a)\b[^>]*\bonclick\s*=[^>]*>/gi).filter(({ match }) =>
        match[1].toLowerCase() === 'a' ? !/\bhref\s*=/.test(match[0]) : !/\brole\s*=/.test(match[0])
      )
  },
  {
    id: 'slds-override',
    kind: 'css',
    severity: 'warning',
    message:
      'Restyles an SLDS class or the inside of a base component - unsupported, and it breaks with SLDS updates. Style a class of your own, or set a styling hook.',
    check: ({ code }) =>
      [...code.matchAll(/[^{};@]*\.slds-[\w-]+[^{};]*\{/g)].map((match) => ({
        line: lineOf(code, match.index + match[0].indexOf('.slds-'))
      }))
  },
  {
    id: 'design-token',
    kind: 'css',
    severity: 'warning',
    message:
      'SLDS 1 design token - it does not exist in SLDS 2. Use a global styling hook (--slds-g-*) with a fallback value.',
    check: ({ code }) => matchLines(code, /var\(\s*--lwc-[A-Za-z]/g)
  },
  {
    id: 'hardcoded-color',
    kind: 'css',
    severity: 'warning',
    message:
      'Fixed color - it ignores the theme and dark mode. Use a --slds-g-color-* styling hook, with this value as fallback if needed.',
    check: ({ code }) =>
      code
        .split('\n')
        .map((text, i) => ({ line: i + 1, text }))
        .filter(
          ({ text }) =>
            /:/.test(text) &&
            !/^\s*--/.test(text) &&
            /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/i.test(withoutVarCalls(text.slice(text.indexOf(':'))))
        )
  },
  {
    id: 'important',
    kind: 'css',
    severity: 'warning',
    message: '!important is usually a fight with SLDS that a styling hook or a class of your own wins cleanly.',
    check: ({ code }) => matchLines(code, /!important\b/g)
  },
  {
    id: 'meta-api-version',
    kind: 'meta',
    severity: 'warning',
    message: 'No apiVersion - the component then follows whatever version the deployment uses.',
    check: ({ code }) => (/<apiVersion\b/.test(code) ? [] : [{ line: 1 }])
  },
  {
    id: 'meta-targets',
    kind: 'meta',
    severity: 'warning',
    message: 'Exposed without a target - nobody can place it anywhere.',
    check: ({ code }) =>
      /<isExposed>\s*true\s*<\/isExposed>/.test(code) && !/<target\b/.test(code) ? [{ line: 1 }] : []
  },
  {
    id: 'meta-label',
    kind: 'meta',
    severity: 'warning',
    message: 'Exposed without masterLabel and description - the Lightning App Builder shows the folder name instead.',
    check: ({ code }) =>
      /<isExposed>\s*true\s*<\/isExposed>/.test(code) && !(/<masterLabel\b/.test(code) && /<description\b/.test(code))
        ? [{ line: 1 }]
        : []
  },
  {
    id: 'test-focused',
    kind: 'test',
    severity: 'warning',
    message: 'Focused or skipped test - it silently changes what runs in CI.',
    check: ({ code }) =>
      matchLines(
        code,
        /(?<![\w$.])(?:fit|fdescribe|xit|xdescribe|xtest)\s*\(|\b(?:it|test|describe)\s*\.\s*(?:only|skip)\s*\(/g
      )
  },
  {
    id: 'test-cleanup',
    kind: 'test',
    severity: 'warning',
    message:
      'Appends components to document.body without removing them - the DOM is shared by every test in the file. Empty it in afterEach.',
    check: ({ code }) =>
      /document\.body\.appendChild/.test(code) && !/afterEach/.test(code)
        ? matchLines(code, /document\.body\.appendChild/g).slice(0, 1)
        : []
  },
  {
    id: 'test-accessibility',
    kind: 'test',
    severity: 'info',
    message: 'No accessibility assertion. Add await expect(element).toBeAccessible() with @sa11y/jest.',
    check: ({ code }) => (/toBeAccessible\s*\(/.test(code) ? [] : [{ line: 1 }])
  },
  {
    id: 'bundle-test',
    kind: 'bundle',
    severity: 'info',
    message: 'No Jest tests in __tests__.',
    check: ({ bundle }) => (bundle.hasTests ? [] : [{ line: 1 }])
  }
];

// --------------------------------------------------------------------- engine

function fileKind(path) {
  const parts = path.split(/[\\/]/);
  if (!parts.includes('lwc')) return null;
  if (parts.includes('__tests__') || /\.test\.[jt]s$/.test(path)) return /\.[jt]s$/.test(path) ? 'test' : null;
  if (path.endsWith('.js-meta.xml')) return 'meta';
  if (/\.[jt]s$/.test(path) && !path.endsWith('.d.ts')) return 'js';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return null;
}

const PREPARE = {
  js: blankJsComments,
  test: blankJsComments,
  html: blankHtmlComments,
  css: blankCssComments,
  meta: blankHtmlComments
};

/** Rule ids a line is exempt from, by a suppression comment on it or on the line above that gives a reason. */
function suppressions(source) {
  const byLine = new Map();
  source.split('\n').forEach((text, i) => {
    for (const match of text.matchAll(/lwc-check-ignore\s+([\w-]+(?:\s*,\s*[\w-]+)*)\s+--\s*(\S[^*>]*)/g)) {
      for (const id of match[1].split(/\s*,\s*/)) {
        for (const line of [i + 1, i + 2]) byLine.set(line, new Set([...(byLine.get(line) ?? []), id]));
      }
    }
  });
  return byLine;
}

function bundleOf(folder) {
  const entries = existsSync(folder) ? readdirSync(folder) : [];
  return {
    folder,
    html: entries.filter((name) => name.endsWith('.html')).map((name) => readFileSync(join(folder, name), 'utf8')),
    hasTests: entries.includes('__tests__')
  };
}

function checkFile(path, { errorsOnly = false } = {}) {
  const kind = fileKind(path);
  if (!kind) return [];
  const source = readFileSync(path, 'utf8');
  const code = PREPARE[kind](source);
  const exempt = suppressions(source);
  const bundle = bundleOf(dirname(path));
  return rules
    .filter((rule) => rule.kind === kind && (!errorsOnly || rule.severity === 'error'))
    .flatMap((rule) =>
      rule
        .check({ code, bundle })
        .filter(({ line }) => !exempt.get(line)?.has(rule.id))
        .map(({ line }) => ({ file: path, line, rule: rule.id, severity: rule.severity, message: rule.message }))
    );
}

function checkBundle(folder) {
  const bundle = bundleOf(folder);
  const main = join(folder, `${basename(folder)}.js`);
  if (!existsSync(main) && !existsSync(join(folder, `${basename(folder)}.ts`))) return [];
  return rules
    .filter((rule) => rule.kind === 'bundle')
    .flatMap((rule) =>
      rule
        .check({ bundle })
        .map(() => ({ file: folder, line: 0, rule: rule.id, severity: rule.severity, message: rule.message }))
    );
}

/** Every checkable file below a path, and the component folders among them. */
function collect(path, files = [], bundles = new Set()) {
  const stats = statSync(path);
  if (stats.isFile()) {
    if (fileKind(path)) files.push(path);
    return { files, bundles };
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (SKIPPED_FOLDERS.has(entry.name) || (entry.name.startsWith('.') && entry.isDirectory())) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (basename(path) === 'lwc') bundles.add(child);
      collect(child, files, bundles);
    } else if (fileKind(child)) files.push(child);
  }
  return { files, bundles };
}

// ----------------------------------------------------------------------- CLI

function report(findings, fileCount) {
  const counts = { error: 0, warning: 0, info: 0 };
  const byFile = new Map();
  for (const finding of findings) {
    counts[finding.severity]++;
    byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding]);
  }
  for (const [file, list] of byFile) {
    console.log(relative(process.cwd(), file) || file);
    list
      .sort((a, b) => a.line - b.line || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .forEach(({ line, severity, rule, message }) =>
        console.log(`  ${String(line || '-').padStart(4)}  ${severity.padEnd(7)}  ${rule.padEnd(20)}  ${message}`)
      );
    console.log('');
  }
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  console.log(
    `${count(counts.error, 'error')}, ${count(counts.warning, 'warning')}, ${count(counts.info, 'info')} in ${byFile.size} of ${count(fileCount, 'file')}`
  );
}

function runHook() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const path = event?.tool_input?.file_path;
  if (typeof path !== 'string' || !fileKind(path) || !existsSync(path)) return;
  const errors = checkFile(path, { errorsOnly: true });
  if (errors.length === 0) return;
  const lines = errors.map(({ line, rule, message }) => `- line ${line}, ${rule}: ${message}`);
  const reason = [
    `lwc-check found ${errors.length} error(s) in ${basename(path)} that must not ship:`,
    ...lines,
    'Fix them now. Only if the team decided to keep one, add "lwc-check-ignore <rule> -- <reason>" as a comment on that line or the line above.'
  ].join('\n');
  console.log(JSON.stringify({ decision: 'block', reason }));
}

function main(argv) {
  if (argv.includes('--hook')) return runHook();
  const errorsOnly = argv.includes('--errors-only');
  const json = argv.includes('--json');
  const unknown = argv.filter((arg) => arg.startsWith('--') && !['--errors-only', '--json'].includes(arg));
  if (unknown.length) {
    console.error(`Unknown option ${unknown[0]}. Usage: lwc-check.mjs [path...] [--errors-only] [--json] | --hook`);
    process.exit(2);
  }
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  const files = [];
  const bundles = new Set();
  for (const path of paths.length ? paths : ['.']) {
    if (!existsSync(path)) {
      console.error(`No such file or folder: ${path}`);
      process.exit(2);
    }
    collect(path, files, bundles);
    if (basename(dirname(path)) === 'lwc' && statSync(path).isDirectory()) bundles.add(path);
  }
  const findings = [
    ...files.flatMap((file) => checkFile(file, { errorsOnly })),
    ...(errorsOnly ? [] : [...bundles].flatMap(checkBundle))
  ];
  if (json) console.log(JSON.stringify(findings, null, 2));
  else if (files.length === 0)
    console.log('No Lightning web component files found - only files inside an lwc folder are checked.');
  else report(findings, files.length);
  process.exitCode = findings.some((finding) => finding.severity === 'error') ? 1 : 0;
}

main(process.argv.slice(2));
