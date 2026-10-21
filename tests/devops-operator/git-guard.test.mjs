// Runs the DevOps Operator's git guard hook against real, throwaway git
// repositories, the way Claude Code calls it: the hook event as JSON on stdin,
// the permission decision as JSON on stdout. BASH selects the shell, e.g.
// BASH=/bin/bash to check the bash 3.2 that ships with macOS.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const hook = new URL('../../plugins/devops-operator/hooks/git-guard.sh', import.meta.url).pathname;
const shell = process.env.BASH_BIN || 'bash';

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
}

/** A repository on `branch`, optionally a Salesforce project and with a config file. */
function repo({ branch = 'feature/ABC-1-discount', salesforce = true, config } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'git-guard-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  if (salesforce) writeFileSync(join(dir, 'sfdx-project.json'), '{}');
  if (config) {
    mkdirSync(join(dir, '.github'));
    writeFileSync(join(dir, '.github', 'salesforce-devops.yml'), config);
  }
  writeFileSync(join(dir, 'README.md'), 'test');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  if (branch !== 'main') git(dir, 'switch', '-q', '-c', branch);
  return dir;
}

/** The decision for a Bash tool call: 'deny', 'ask', or 'allow' when the hook stays silent. */
function decide(command, cwd) {
  const event = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd };
  const out = execFileSync(shell, [hook], { input: JSON.stringify(event), encoding: 'utf8' }).trim();
  if (!out) return 'allow';
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.ok(decision.permissionDecisionReason.length > 20, 'a decision always explains itself');
  return decision.permissionDecision;
}

const b2 = 'version: 1\nblueprint: B2\nenvironments: [integration, uat, preprod, main] # promotion order\nbase: main\n';
const b5 =
  'version: 1\nblueprint: B5\nenvironments:\n  - uat\n  - main\nbase: uat\nbranches:\n  feature: feature/{item}\n';

describe('scope', () => {
  test('ignores commands that are not git or gh', () => {
    assert.equal(decide('sf project retrieve start --metadata Flow:Discount', repo()), 'allow');
  });

  test('ignores repositories that are not Salesforce projects', () => {
    assert.equal(decide('git push --force', repo({ salesforce: false })), 'allow');
  });

  test('applies to repositories that only have the config file', () => {
    assert.equal(decide('git push --force', repo({ salesforce: false, config: b2 })), 'deny');
  });
});

describe('force pushes', () => {
  const dir = repo();
  for (const command of [
    'git push --force',
    'git push -f origin feature/ABC-1-discount',
    'git push -uf origin feature/ABC-1-discount',
    'git push --force-with-lease',
    'git push origin +feature/ABC-1-discount'
  ]) {
    test(`denies ${command}`, () => assert.equal(decide(command, dir), 'deny'));
  }

  test('allows a normal push of a work branch', () => {
    assert.equal(decide('git push -u origin feature/ABC-1-discount', dir), 'allow');
  });

  test('allows pushing tags', () => {
    assert.equal(decide('git push origin --tags', repo({ branch: 'main' })), 'allow');
  });
});

describe('environment branches', () => {
  test('denies pushing the current environment branch', () => {
    assert.equal(decide('git push', repo({ branch: 'main' })), 'deny');
  });

  test('denies pushing a work branch into an environment branch', () => {
    const dir = repo({ config: b2 });
    assert.equal(decide('git push origin HEAD:uat', dir), 'deny');
    assert.equal(decide('git push origin feature/ABC-1-discount:refs/heads/preprod', dir), 'deny');
  });

  test('denies commits on an environment branch from the config file', () => {
    assert.equal(decide('git add . && git commit -m "add discount flow"', repo({ branch: 'uat', config: b5 })), 'deny');
  });

  test('reads a flow-style list with a trailing comment', () => {
    assert.equal(decide('git commit -m wip', repo({ branch: 'integration', config: b2 })), 'deny');
  });

  test('falls back to main without a config file', () => {
    assert.equal(decide('git merge feature/ABC-1-discount', repo({ branch: 'main' })), 'deny');
  });

  test('allows commits on a work branch', () => {
    assert.equal(decide('git commit -m "feat: add discount flow"', repo({ config: b2 })), 'allow');
  });

  test('allows aborting a merge on an environment branch', () => {
    assert.equal(decide('git merge --abort', repo({ branch: 'main' })), 'allow');
  });

  test('follows git -C to another repository', () => {
    const env = repo({ branch: 'main' });
    assert.equal(decide(`git -C ${env} commit -m wip`, repo({ salesforce: false })), 'deny');
  });

  test('handles quotes and escapes in commit messages', () => {
    assert.equal(decide('git commit -m "fix: say \\"hello\\" in the flow"', repo({ branch: 'main' })), 'deny');
  });
});

describe('commands that throw work away', () => {
  const dir = repo();
  for (const command of [
    'git reset --hard',
    'git reset --hard origin/main',
    'git clean -fd',
    'git checkout -- force-app',
    'git checkout .',
    'git restore force-app/main/default/flows/Discount.flow-meta.xml',
    'git restore --staged --worktree .',
    'git switch --discard-changes main',
    'git branch -D feature/old',
    'git stash drop',
    'git push origin --delete feature/old',
    'git push origin :feature/old',
    'gh pr merge 12 --squash'
  ]) {
    test(`asks before ${command}`, () => assert.equal(decide(command, dir), 'ask'));
  }

  for (const command of [
    'git reset --keep origin/main',
    'git reset HEAD~1',
    'git clean -n',
    'git restore --staged force-app',
    'git branch -d feature/old',
    'git branch --show-current',
    'git stash',
    'git switch -c feature/ABC-2-pricing origin/main',
    'git checkout -b feature/ABC-2-pricing'
  ]) {
    test(`allows ${command}`, () => assert.equal(decide(command, dir), 'allow'));
  }
});
