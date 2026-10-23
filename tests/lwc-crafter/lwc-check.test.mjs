// Runs the LWC Crafter's checker against two components in fixtures/: one that
// follows every rule and must stay silent, and one with a known finding on
// every line that matters.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const script = new URL('../../plugins/lwc-crafter/skills/salesforce-lwc-crafter/scripts/lwc-check.mjs', import.meta.url)
  .pathname;
const fixtures = new URL('./fixtures/', import.meta.url).pathname;
const lwc = `${fixtures}force-app/main/default/lwc`;

/** Output and exit code of one run from the fixture project. */
function run(args, input) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: fixtures, encoding: 'utf8', input });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

/** The findings of a JSON run, as "<file name>:<line> <rule>". */
function findings(args) {
  const { out } = run([...args, '--json']);
  return JSON.parse(out).map(({ file, line, rule }) => `${file.split('/').pop()}:${line} ${rule}`);
}

describe('a component that follows the rules', () => {
  test('has no findings at all', () => {
    const { status, out } = run(['--json', `${lwc}/cleanCard`]);
    assert.equal(status, 0);
    assert.deepEqual(JSON.parse(out), []);
  });

  test('ignores code in comments and color fallbacks inside var()', () => {
    assert.deepEqual(findings([`${lwc}/cleanCard/cleanCard.js`, `${lwc}/cleanCard/cleanCard.css`]), []);
  });
});

describe('a component with anti-patterns', () => {
  const all = findings([`${lwc}/riskyWidget`]);

  test('reports every error on its line', () => {
    const errors = findings([`${lwc}/riskyWidget`, '--errors-only']);
    assert.deepEqual(errors.sort(), [
      'riskyWidget.html:9 no-external-script',
      'riskyWidget.js:15 no-unsafe-html',
      'riskyWidget.js:17 no-eval',
      'riskyWidget.js:18 no-blocked-api',
      'riskyWidget.js:19 no-legacy-global',
      'riskyWidget.js:30 no-eval'
    ]);
  });

  test('fails the run when there is an error', () => {
    assert.equal(run([`${lwc}/riskyWidget`]).status, 1);
  });

  test('reports lifecycle, event and data warnings in the JavaScript', () => {
    for (const expected of [
      'riskyWidget.js:1 no-pubsub',
      'riskyWidget.js:6 track-primitive',
      'riskyWidget.js:9 listener-cleanup',
      'riskyWidget.js:9 bind-in-listener',
      'riskyWidget.js:10 resource-cleanup',
      'riskyWidget.js:20 no-document-query',
      'riskyWidget.js:20 manual-dom',
      'riskyWidget.js:24 api-reassign',
      'riskyWidget.js:24 hardcoded-id',
      'riskyWidget.js:25 event-name',
      'riskyWidget.js:25 event-composed',
      'riskyWidget.js:26 hardcoded-url',
      'riskyWidget.js:26 navigation',
      'riskyWidget.js:31 native-dialog',
      'riskyWidget.js:31 no-console'
    ]) {
      assert.ok(all.includes(expected), `missing ${expected}`);
    }
  });

  test('reports template, styling and metadata warnings', () => {
    for (const expected of [
      'riskyWidget.html:2 legacy-directive',
      'riskyWidget.html:2 click-only',
      'riskyWidget.html:4 index-key',
      'riskyWidget.html:6 img-alt',
      'riskyWidget.html:7 icon-button-label',
      'riskyWidget.css:1 slds-override',
      'riskyWidget.css:2 hardcoded-color',
      'riskyWidget.css:2 important',
      'riskyWidget.css:3 design-token',
      'riskyWidget.css:4 component-hook',
      'riskyWidget.js-meta.xml:1 meta-api-version',
      'riskyWidget.js-meta.xml:1 meta-targets',
      'riskyWidget.js-meta.xml:1 meta-label',
      'riskyWidget:0 bundle-test'
    ]) {
      assert.ok(all.includes(expected), `missing ${expected}`);
    }
  });

  test('does not flag clearing innerHTML or a script tag in a comment', () => {
    assert.ok(!all.includes('riskyWidget.js:16 no-unsafe-html'));
    assert.ok(!all.includes('riskyWidget.html:8 no-external-script'));
  });

  test('honours a suppression only when it gives a reason', () => {
    assert.ok(!all.includes('riskyWidget.js:28 no-eval'), 'suppressed with a reason');
    assert.ok(all.includes('riskyWidget.js:30 no-eval'), 'suppression without a reason');
  });
});

describe('paths', () => {
  test('searches the working directory without a path and summarises', () => {
    const { out } = run([]);
    assert.match(out, /6 errors, \d+ warnings, 1 info in 5 of 9 files/);
  });

  test('ignores files outside an lwc folder', () => {
    const { status, out } = run([`${fixtures}../lwc-check.test.mjs`]);
    assert.equal(status, 0);
    assert.match(out, /No Lightning web component files found/);
  });

  test('rejects unknown options and missing paths', () => {
    assert.equal(run(['--fix']).status, 2);
    assert.equal(run(['does-not-exist']).status, 2);
  });
});

describe('documentation', () => {
  test('the review reference lists every rule of the checker, and no other', () => {
    const ids = (text, pattern) => [...new Set([...text.matchAll(pattern)].map((m) => m[1]))].sort();
    const source = readFileSync(script, 'utf8');
    const review = readFileSync(new URL('../references/review.md', `file://${script}`), 'utf8');
    assert.deepEqual(ids(review, /^\| `([a-z-]+)` /gm), ids(source, /^ {4}id: '([a-z-]+)'/gm));
  });
});

describe('--hook', () => {
  const event = (filePath) => JSON.stringify({ hook_event_name: 'PostToolUse', tool_input: { file_path: filePath } });

  test('blocks with the errors of the written file', () => {
    const { status, out } = run(['--hook'], event(`${lwc}/riskyWidget/riskyWidget.js`));
    assert.equal(status, 0);
    const answer = JSON.parse(out);
    assert.equal(answer.decision, 'block');
    assert.match(answer.reason, /5 error\(s\) in riskyWidget\.js/);
    assert.match(answer.reason, /line 15, no-unsafe-html/);
    assert.doesNotMatch(answer.reason, /no-pubsub/, 'warnings stay out of the hook');
  });

  test('stays silent for a clean file, a file outside lwc and broken input', () => {
    assert.equal(run(['--hook'], event(`${lwc}/cleanCard/cleanCard.js`)).out, '');
    assert.equal(run(['--hook'], event(`${fixtures}../lwc-check.test.mjs`)).out, '');
    assert.equal(run(['--hook'], 'not json').out, '');
  });
});
