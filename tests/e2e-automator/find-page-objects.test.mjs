// Runs the E2E Automator's page object finder against a small, made-up
// salesforce-pageobjects package in fixtures/ - the same folder layout, manifest
// and declaration files as the real package, without its content.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const script = new URL(
  '../../plugins/e2e-automator/skills/salesforce-e2e-automator/scripts/find-page-objects.mjs',
  import.meta.url
).pathname;
const fixtures = new URL('./fixtures/', import.meta.url).pathname;
const pkg = join(fixtures, 'salesforce-pageobjects');

/** Output and exit code of one run; `--dir` points at the fixture package unless `cwd` is given. */
function run(args, { cwd } = {}) {
  const result = spawnSync(process.execPath, [script, ...args, ...(cwd ? [] : ['--dir', pkg])], {
    cwd: cwd ?? fixtures,
    encoding: 'utf8'
  });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

describe('search', () => {
  test('ranks the page object whose selector is the term first', () => {
    const { status, out } = run(['search', 'acme-card']);
    assert.equal(status, 0);
    assert.match(out, /^salesforce-pageobjects@99\.0\.0 - 2 of 2 matches/);
    const paths = out.match(/^salesforce-pageobjects\/\S+/gm);
    assert.deepEqual(paths, [
      'salesforce-pageobjects/widgets/pageObjects/card',
      'salesforce-pageobjects/widgets/pageObjects/cardList'
    ]);
  });

  test('requires every term to match', () => {
    assert.match(run(['search', 'card', 'title']).out, /2 of 2 matches/);
    assert.match(run(['search', 'card', 'nonexistent']).out, /0 of 0 matches/);
  });

  test('--root keeps only page objects that utam.load can start from', () => {
    const { out } = run(['search', 'acme-card', '--root']);
    assert.doesNotMatch(out, /pageObjects\/card$/m);
    assert.match(out, /pageObjects\/cardList {2}\[root\]/);
  });

  test('leaves out mobile app page objects unless asked for', () => {
    assert.doesNotMatch(run(['search', 'feed']).out, /chatter\/feed/);
    assert.match(
      run(['search', 'feed', '--mobile']).out,
      /salesforce-pageobjects\/salesforceapp\/pageObjects\/chatter\/feed/
    );
  });

  test('marks interfaces', () => {
    assert.match(run(['search', 'record', 'home']).out, /recordHome {2}\[root, interface\]/);
  });

  test('needs a term', () => {
    assert.equal(run(['search']).status, 1);
  });
});

describe('show', () => {
  test('prints the import, the description and every member with its first doc line', () => {
    const { status, out } = run(['show', 'salesforce-pageobjects/widgets/pageObjects/card']);
    assert.equal(status, 0);
    assert.match(out, /^import Card from 'salesforce-pageobjects\/widgets\/pageObjects\/card';$/m);
    assert.match(out, /^ {2}Represents the acme-card component\.$/m);
    assert.match(out, /^ {2}getTitle\(\): Promise<string>\n {6}Returns the card title$/m);
    assert.match(out, /^ {2}getRoot\(\): Promise<\(BaseUtamElement\)>$/m);
    assert.match(out, /Not a root page object/);
    assert.doesNotMatch(out, /Copyright|generated from|constructor/);
  });

  test('lists the page objects a signature returns, with their import paths', () => {
    const { out } = run(['show', 'salesforce-pageobjects/widgets/pageObjects/cardList']);
    assert.match(out, /Root page object - load it with utam\.load\(CardList\)\./);
    assert.match(out, /^ {2}waitForCard\(title: string\): Promise<Card>$/m);
    assert.match(out, /^ {2}Card {2}salesforce-pageobjects\/widgets\/pageObjects\/card$/m);
  });

  test('resolves a UTAM type and lists the implementations of an interface', () => {
    const { status, out } = run(['show', 'utam-global/pageObjects/recordHome']);
    assert.equal(status, 0);
    assert.match(out, /Interface/);
    assert.match(out, /salesforce-pageobjects\/global\/pageObjects\/recordHomeDesktop {2}selector: one-record-home/);
  });

  test('finds declarations in subfolders, as the mobile page objects have them', () => {
    const { out } = run(['show', 'salesforce-pageobjects/salesforceapp/pageObjects/chatter/feed']);
    assert.match(out, /getPosts\(\): Promise<string\[\]>/);
  });

  test('takes a bare name when it is unique, and asks for the import path when it is not', () => {
    const unique = run(['show', 'recordhome']);
    assert.equal(unique.status, 0);
    assert.match(unique.out, /import RecordHome /, 'names match case-insensitively, but whole');
    const ambiguous = run(['show', 'card']);
    assert.equal(ambiguous.status, 2);
    assert.match(ambiguous.out, /matches 2 page objects/);
    assert.match(ambiguous.out, /salesforce-pageobjects\/legacy\/pageObjects\/card {2}\[root\]/);
    assert.equal(run(['show', 'nothing']).status, 1);
  });

  test("reads a project's compiled page object", () => {
    const { status, out } = run(['show', join(fixtures, 'project', 'pageObjects', 'orderSummary.d.ts')], {
      cwd: fixtures
    });
    assert.equal(status, 0);
    assert.match(out, /Not a root page object/);
    assert.match(out, /^ {2}filterLines\(term: string\): Promise<void>\n {6}Types a search term into the filter$/m);
    assert.match(out, /^ {2}OrderLine {2}\.\.\/pageObjects\/orderLine$/m);
  });
});

describe('package lookup', () => {
  test('finds the package in node_modules from a subfolder of the project', () => {
    const project = mkdtempSync(join(tmpdir(), 'find-page-objects-'));
    cpSync(pkg, join(project, 'node_modules', 'salesforce-pageobjects'), { recursive: true });
    mkdirSync(join(project, 'force-app', 'test'), { recursive: true });
    const { status, out } = run(['search', 'acme-card'], { cwd: join(project, 'force-app', 'test') });
    assert.equal(status, 0);
    assert.match(out, /2 of 2 matches/);
    const { out: interfaceOut } = run(['show', 'recordHome'], { cwd: project });
    assert.match(interfaceOut, /recordHomeDesktop/, 'the manifest resolves inside node_modules as well');
  });

  test('says how to fix a project without the package', () => {
    const empty = mkdtempSync(join(tmpdir(), 'find-page-objects-'));
    const { status, err } = run(['search', 'card'], { cwd: empty });
    assert.equal(status, 1);
    assert.match(err, /not installed here/);
  });
});
