// Runs the Multi-Framework Wizard's X-ray against three projects in fixtures/:
// one that wires every surface right and must stay silent, one with a known
// finding for every rule, and one that frames apps without any trusted site.

import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const script = new URL(
  '../../plugins/multi-framework-wizard/skills/salesforce-multi-framework-wizard/scripts/xray.mjs',
  import.meta.url
).pathname;
const fixtures = new URL('./fixtures/', import.meta.url).pathname;

/** Output and exit code of one run. */
function run(args, cwd = fixtures) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

/** The JSON report of a fixture project. */
function report(project, ...args) {
  return JSON.parse(run([`${fixtures}${project}`, '--json', ...args]).out);
}

/** The findings of a JSON run, as "<file name>:<line> <rule>". */
const findings = (project, ...args) =>
  report(project, ...args).findings.map(({ file, line, rule }) => `${file.split('/').pop()}:${line} ${rule}`);

describe('a project that wires every surface right', () => {
  test('has no findings and exits 0', () => {
    const { status } = run([`${fixtures}clean-project`]);
    assert.equal(status, 0);
    assert.deepEqual(findings('clean-project'), []);
  });

  test('maps bundles, hosts, trusted sites and channels', () => {
    const map = report('clean-project');
    assert.deepEqual(
      map.bundles.map(({ name, framework, app, dataSdk, embeddable, built }) => ({
        name,
        framework,
        app,
        dataSdk,
        embeddable,
        built
      })),
      [{ name: 'cabinet', framework: 'React', app: 'cabinet', dataSdk: true, embeddable: true, built: true }]
    );
    assert.deepEqual(
      map.hosts.map(({ name, frames, events, channels, writes, handlesErrors }) => ({
        name,
        frames,
        events,
        channels,
        writes,
        handlesErrors
      })),
      [
        {
          name: 'gameHost',
          frames: 1,
          events: ['gameover'],
          channels: ['Result_Channel'],
          writes: true,
          handlesErrors: true
        }
      ]
    );
    assert.deepEqual(map.channels, ['Result_Channel']);
    const local = map.trustedSites.find((site) => site.name === 'Cabinet_Localhost');
    assert.equal(local.inPackage, false);
  });

  test('names the integration patterns in the numbering of Polyglot Arcade', () => {
    assert.deepEqual(
      report('clean-project')
        .patterns.map(({ no, what }) => `${no} ${what}`)
        .sort(),
      ['2 cabinet', '3 cabinet framed by gameHost', '4 https://guest.example.com framed by gameHost']
    );
  });

  test('finds the project root from a folder inside it', () => {
    const { out } = run(['--json'], `${fixtures}clean-project/force-app/main/default/lwc`);
    assert.equal(JSON.parse(out).bundles.length, 1);
  });

  test('draws the map as a Mermaid flowchart', () => {
    const { out } = run([`${fixtures}clean-project`, '--mermaid']);
    assert.match(out, /^flowchart LR/);
    assert.match(out, /bundle_cabinet\["<b>Cabinet<\/b><br\/>React UI bundle"\]/);
    assert.match(out, /host_gameHost -- "frames · props, events" --> bundle_cabinet/);
    assert.match(out, /host_gameHost -- "frames · props, events" --> guest_Guest_Example/);
    assert.match(out, /bundle_cabinet -- "Data SDK GraphQL" --> Data/);
    assert.doesNotMatch(out, /localhost/);
  });
});

describe('a project with every mistake', () => {
  const all = findings('risky-project');

  test('reports every error on its line and exits 1', () => {
    assert.equal(run([`${fixtures}risky-project`]).status, 1);
    assert.deepEqual(findings('risky-project', '--errors-only').sort(), [
      'Everything.cspTrustedSite-meta.xml:4 csp-wildcard',
      'Item__c.json:6 hardcoded-bundle-url',
      'app.js:2 sdk-in-lwr',
      'links.ts:12 postmessage-any-origin',
      'links.ts:28 hardcoded-bundle-url',
      'links.ts:3 org-relative-bundle-url',
      'links.ts:4 hardcoded-bundle-url'
    ]);
  });

  test('reports the warnings and infos', () => {
    for (const expected of [
      'links.ts:5 lightning-link-without-app',
      'links.ts:8 api-version-literal',
      'links.ts:16 message-origin-check',
      'links.ts:20 embed-bootstrap',
      'frameHost.html:4 embed-remount',
      'frameHost.html:4 embed-sandbox',
      'frameHost.html:0 csp-internal-frame',
      'frameHost.js:0 embed-error-unhandled',
      'jest.config.js:0 jest-embedding-stub',
      'hub.uibundle-meta.xml:0 bundle-no-app',
      'hub.uibundle-meta.xml:0 bundle-not-built',
      'cabinet.uibundle-meta.xml:0 bundle-not-built',
      'player.permissionset-meta.xml:3 app-hidden',
      'Vercel_Wildcard.cspTrustedSite-meta.xml:4 csp-wildcard',
      'Local_Dev.cspTrustedSite-meta.xml:4 dev-site-in-package',
      'Guest_Wide.cspTrustedSite-meta.xml:4 csp-extra-directives'
    ]) {
      assert.ok(all.includes(expected), `missing ${expected}`);
    }
    assert.equal(all.length, 23);
  });

  test('honours a suppression with a reason, and only then', () => {
    assert.ok(!all.includes('links.ts:25 hardcoded-bundle-url'));
    assert.ok(all.includes('links.ts:28 hardcoded-bundle-url'));
  });

  test('ignores commented-out frames and test files', () => {
    assert.equal(report('risky-project').hosts[0].frames, 1);
    assert.ok(!findings('clean-project').some((finding) => finding.startsWith('embed.test.ts')));
  });

  test('leaves MessagePort listeners alone', () => {
    assert.ok(!findings('clean-project').some((finding) => finding.endsWith('message-origin-check')));
  });
});

describe('a project that frames apps without a trusted site', () => {
  test('reports the missing frame-src site', () => {
    assert.deepEqual(findings('no-csp-project'), ['plainHost.html:0 embed-no-csp']);
  });
});

describe('the command line', () => {
  test('rejects unknown options and missing paths', () => {
    assert.equal(run(['--verbose']).status, 2);
    assert.equal(run([`${fixtures}does-not-exist`]).status, 2);
  });
});
