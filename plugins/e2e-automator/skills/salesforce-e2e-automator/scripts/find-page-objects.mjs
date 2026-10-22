#!/usr/bin/env node
// Finds page objects in the salesforce-pageobjects package a project has
// installed, and prints the API of one - so a test is written against the page
// objects of the release the project actually uses, not against memory.
//
//   node find-page-objects.mjs search <term>... [--root] [--mobile] [--limit <n>]
//   node find-page-objects.mjs show <import path | name | utam type | .d.ts file>
//
// `search` ranks page objects by selector, name and description; every term
// must match. Page objects of the mobile apps are left out unless --mobile is
// given. `show` prints the members of one page object from its compiled type
// declarations, which hold the exact signatures, and lists the implementations
// of an interface. It also reads the .d.ts files the UTAM compiler writes for a
// project's own page objects.
//
// --dir <path> points to the package; by default it is looked up in
// node_modules from the working directory upwards.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const PACKAGE = 'salesforce-pageobjects';
const MOBILE = /\/(salesforceapp|sfsmobileapp)\//;

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { root: false, mobile: false, limit: 15, dir: undefined, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') options.root = true;
    else if (arg === '--mobile') options.mobile = true;
    else if (arg === '--limit') options.limit = Number(argv[++i]);
    else if (arg === '--dir') options.dir = argv[++i];
    else options.rest.push(arg);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) fail('--limit needs a positive number');
  return options;
}

function findPackage(dir) {
  if (dir) {
    const root = resolve(dir);
    if (!existsSync(join(root, 'package.json'))) fail(`No package found at ${root}`);
    return root;
  }
  for (let current = process.cwd(); ; current = dirname(current)) {
    const candidate = join(current, 'node_modules', PACKAGE);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(current) === current) break;
  }
  fail(`${PACKAGE} is not installed here. Run npm install in the project, or pass --dir <path to the package>.`);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.utam.json')) yield path;
  }
}

/** Description lines of a page object, whatever shape the JSON uses. */
function descriptionLines(description) {
  if (!description) return [];
  if (typeof description === 'string') return [description];
  if (Array.isArray(description)) return description;
  return [description.text ?? []].flat();
}

/**
 * The compiled declarations of dist/<a>/<b>/<name>.utam.json live in
 * dist/<a>/<b>/pageObjects/<name>.d.ts, or - for page objects in subfolders -
 * further up, e.g. dist/<a>/pageObjects/<b>/<name>.d.ts. The import path
 * follows the same folders.
 */
function locateDeclarations(dist, jsonPath) {
  const parts = relative(dist, dirname(jsonPath)).split(sep).filter(Boolean);
  const name = jsonPath.slice(dirname(jsonPath).length + 1, -'.utam.json'.length);
  for (let i = parts.length; i >= 0; i--) {
    const segments = [...parts.slice(0, i), 'pageObjects', ...parts.slice(i), name];
    const declarations = join(dist, ...segments) + '.d.ts';
    if (existsSync(declarations)) return { declarations, importPath: `${PACKAGE}/${segments.join('/')}`, name };
  }
  return { declarations: undefined, importPath: undefined, name };
}

function loadCatalog(packageRoot) {
  const dist = join(packageRoot, 'dist');
  if (!existsSync(dist)) fail(`${packageRoot} has no dist folder - is this the ${PACKAGE} package?`);
  // The manifest maps each UTAM type (utam-<namespace>/pageObjects/<name>) to
  // its JSON file; element types and `implements` refer to page objects by it.
  // Its paths start with the tarball's folder name, `package/`.
  const manifestPath = join(dist, 'utam.manifest.json');
  const typeByFile = new Map();
  if (existsSync(manifestPath)) {
    const { pageObjects = {} } = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [type, file] of Object.entries(pageObjects)) {
      typeByFile.set(resolve(packageRoot, file.replace(/^package\//, '')), type);
    }
  }
  const entries = [];
  for (const jsonPath of walk(dist)) {
    let json;
    try {
      json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    } catch {
      continue;
    }
    const lines = descriptionLines(json.description);
    const selectorLine = lines.find((line) => /^Selector:/i.test(line));
    const selector = json.selector?.css ?? selectorLine?.replace(/^Selector:\s*/i, '').replace(/\.$/, '');
    entries.push({
      ...locateDeclarations(dist, jsonPath),
      source: relative(packageRoot, jsonPath),
      type: typeByFile.get(resolve(jsonPath)),
      root: Boolean(json.root),
      interface: Boolean(json.interface),
      implements: json.implements,
      selector: selector ?? '',
      summary: lines.find((line) => line !== selectorLine) ?? '',
      text: lines.join(' ').toLowerCase()
    });
  }
  const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  return { version, entries };
}

function score(entry, term) {
  const selector = entry.selector.toLowerCase();
  const name = entry.name.toLowerCase();
  if (selector === term) return 100;
  if (selector.includes(term)) return 60;
  if (name === term) return 50;
  if (name.includes(term)) return 30;
  if (entry.importPath.toLowerCase().includes(term)) return 20;
  if (entry.text.includes(term)) return 10;
  return 0;
}

function search({ version, entries }, terms, options) {
  if (terms.length === 0) fail('search needs at least one term, e.g. search lightning-combobox');
  const wanted = terms.map((term) => term.toLowerCase());
  const phrase = wanted.join(' ');
  const hits = [];
  for (const entry of entries) {
    if (!entry.importPath || (options.root && !entry.root)) continue;
    if (!options.mobile && MOBILE.test(entry.importPath)) continue;
    const scores = wanted.map((term) => score(entry, term));
    if (scores.includes(0)) continue;
    // Words that appear together, as in "list view", beat words scattered over a description.
    const together = wanted.length > 1 && entry.text.includes(phrase) ? 40 : 0;
    hits.push({ entry, total: scores.reduce((a, b) => a + b, together) });
  }
  hits.sort(
    (a, b) =>
      b.total - a.total ||
      Number(b.entry.root) - Number(a.entry.root) ||
      a.entry.importPath.length - b.entry.importPath.length
  );
  const shown = hits.slice(0, options.limit);
  console.log(`${PACKAGE}@${version} - ${shown.length} of ${hits.length} matches for "${terms.join(' ')}"`);
  for (const { entry } of shown) {
    const flags = [entry.root && 'root', entry.interface && 'interface'].filter(Boolean).join(', ');
    console.log(`\n${entry.importPath}${flags ? `  [${flags}]` : ''}`);
    if (entry.selector) console.log(`  selector: ${entry.selector}`);
    if (entry.summary) console.log(`  ${entry.summary}`);
  }
  if (hits.length > shown.length) console.log(`\n... ${hits.length - shown.length} more - add a term or raise --limit`);
}

const docLines = (doc) =>
  doc
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line && !line.startsWith('@') && !line.startsWith('generated from'));

/**
 * The page object class of a .d.ts file - `export default class` in the
 * package, `declare class ... export =` for CommonJS output of a project.
 */
function readDeclarations(path) {
  const text = readFileSync(path, 'utf8').replace(/\b_([A-Z]\w*)/g, '$1');
  const imports = [...text.matchAll(/^import (\w+) from '([^']+)';$/gm)].map(([, name, from]) => ({ name, from }));
  const head = text.match(/^(?:export default |declare )class (\w+) extends (\w+)/m);
  if (!head) fail(`${path} declares no page object class - is it a compiled page object?`);
  const before = text.slice(0, head.index).trimEnd();
  const classDoc = before.endsWith('*/') ? docLines(before.slice(before.lastIndexOf('/**') + 3, -2)) : [];
  const body = text.slice(text.indexOf('{', head.index) + 1, text.lastIndexOf('}'));
  const members = [];
  for (const block of body.split(/;\s*\n/)) {
    const doc = block.match(/\/\*\*([\s\S]*?)\*\//);
    const signature = block
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/;$/, '');
    if (signature && !signature.startsWith('constructor')) {
      members.push({ signature, comment: doc ? docLines(doc[1])[0] : undefined });
    }
  }
  return { className: head[1], root: /RootPageObject$/.test(head[2]), classDoc, imports, members };
}

function printDeclarations(path, header) {
  const api = readDeclarations(path);
  for (const line of header) console.log(line);
  for (const line of api.classDoc) console.log(`  ${line}`);
  console.log(
    api.root
      ? `\nRoot page object - load it with utam.load(${api.className}).`
      : '\nNot a root page object - reach it through a getter of its parent; never load it directly.'
  );
  console.log('\nMembers:');
  for (const { signature, comment } of api.members) {
    console.log(`  ${signature}${comment ? `\n      ${comment}` : ''}`);
  }
  const used = api.imports.filter(({ from }) => !from.startsWith('@utam/'));
  if (used.length) {
    console.log('\nPage objects in these signatures:');
    for (const { name, from } of used) console.log(`  ${name}  ${from}`);
  }
}

function resolveTarget({ entries }, target) {
  const exact = entries.find((entry) => entry.importPath && (entry.importPath === target || entry.type === target));
  if (exact) return [exact];
  const lower = target.toLowerCase();
  return entries.filter(
    (entry) => entry.importPath && (entry.name.toLowerCase() === lower || entry.importPath.endsWith(`/${target}`))
  );
}

function show(target, options) {
  if (!target)
    fail('show needs a page object, e.g. show salesforce-pageobjects/global/pageObjects/recordActionWrapper');
  if (target.endsWith('.d.ts')) {
    if (!existsSync(target)) fail(`${target} does not exist - compile the page objects first`);
    printDeclarations(target, [target]);
    return;
  }
  const catalog = loadCatalog(findPackage(options.dir));
  const matches = resolveTarget(catalog, target);
  if (matches.length === 0) fail(`No page object "${target}" in ${PACKAGE}@${catalog.version} - try search.`);
  if (matches.length > 1) {
    console.log(`"${target}" matches ${matches.length} page objects - show one by its import path:`);
    for (const entry of matches) console.log(`  ${entry.importPath}${entry.root ? '  [root]' : ''}`);
    process.exit(2);
  }
  const [entry] = matches;
  printDeclarations(entry.declarations, [
    `${PACKAGE}@${catalog.version}`,
    `import ${entry.name[0].toUpperCase()}${entry.name.slice(1)} from '${entry.importPath}';`,
    `source: ${entry.source}${entry.selector ? ` - selector: ${entry.selector}` : ''}`
  ]);
  if (entry.interface) {
    const implementations = catalog.entries.filter((other) => entry.type && other.implements === entry.type);
    console.log('\nInterface - the injection config in wdio.conf.js picks the implementation at run time:');
    for (const other of implementations) console.log(`  ${other.importPath}  selector: ${other.selector}`);
  }
}

const [command, ...argv] = process.argv.slice(2);
const options = parseArgs(argv);
if (command === 'search') search(loadCatalog(findPackage(options.dir)), options.rest, options);
else if (command === 'show') show(options.rest[0], options);
else {
  fail(
    'Usage: find-page-objects.mjs search <term>... [--root] [--mobile] [--limit <n>] [--dir <path>]\n' +
      '       find-page-objects.mjs show <import path | name | utam type | .d.ts file> [--dir <path>]'
  );
}
