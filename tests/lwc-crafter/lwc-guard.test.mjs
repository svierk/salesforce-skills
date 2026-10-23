// Runs the LWC Crafter's guard hook the way Claude Code calls it after a Write
// or Edit: the hook event as JSON on stdin, a block decision as JSON on stdout.
// BASH_BIN selects the shell, e.g. BASH_BIN=/bin/bash to check the bash 3.2
// that ships with macOS.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const hook = new URL('../../plugins/lwc-crafter/hooks/lwc-guard.sh', import.meta.url).pathname;
const pluginRoot = new URL('../../plugins/lwc-crafter', import.meta.url).pathname;
const fixtures = new URL('./fixtures/force-app/main/default/lwc/', import.meta.url).pathname;
const shell = process.env.BASH_BIN || 'bash';

/** The hook's stdout for a Write of `filePath`, '' when it stays silent. */
function afterWrite(filePath, env = {}) {
  const event = { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: filePath } };
  return execFileSync(shell, [hook], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, ...env }
  });
}

describe('lwc guard', () => {
  test('hands the errors of a component file back to the agent', () => {
    const answer = JSON.parse(afterWrite(`${fixtures}riskyWidget/riskyWidget.js`));
    assert.equal(answer.decision, 'block');
    assert.match(answer.reason, /no-eval/);
    assert.match(answer.reason, /lwc-check-ignore <rule> -- <reason>/);
  });

  test('checks templates too', () => {
    assert.match(afterWrite(`${fixtures}riskyWidget/riskyWidget.html`), /no-external-script/);
  });

  test('stays silent for a component without errors', () => {
    assert.equal(afterWrite(`${fixtures}cleanCard/cleanCard.js`), '');
  });

  test('stays silent for warnings only', () => {
    assert.equal(afterWrite(`${fixtures}riskyWidget/riskyWidget.css`), '');
  });

  test('stays silent outside lwc folders', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-guard-'));
    writeFileSync(join(dir, 'script.js'), "eval('1 + 1');");
    assert.equal(afterWrite(join(dir, 'script.js')), '');
  });

  test('finds the checker without CLAUDE_PLUGIN_ROOT', () => {
    assert.match(afterWrite(`${fixtures}riskyWidget/riskyWidget.js`, { CLAUDE_PLUGIN_ROOT: '' }), /"block"/);
  });

  test('can be turned off for one person', () => {
    assert.equal(afterWrite(`${fixtures}riskyWidget/riskyWidget.js`, { LWC_CRAFTER_GUARD: 'off' }), '');
  });

  test('reads the whole event when turned off', () => {
    // An event larger than the pipe buffer breaks the pipe if the hook exits before reading it.
    const event = {
      tool_name: 'Write',
      tool_input: { file_path: `${fixtures}cleanCard/cleanCard.js`, content: 'x'.repeat(300000) }
    };
    const out = execFileSync(shell, [hook], {
      input: JSON.stringify(event),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, LWC_CRAFTER_GUARD: 'off' }
    });
    assert.equal(out, '');
  });

  test('reads the file as written, not the fixture it came from', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lwc-guard-'));
    const component = join(dir, 'force-app', 'main', 'default', 'lwc', 'cleanCard');
    cpSync(`${fixtures}cleanCard`, component, { recursive: true });
    assert.equal(afterWrite(join(component, 'cleanCard.js')), '');
    writeFileSync(join(component, 'cleanCard.js'), "export default class X { run() { document.write('x'); } }");
    assert.match(afterWrite(join(component, 'cleanCard.js')), /no-blocked-api/);
  });
});
