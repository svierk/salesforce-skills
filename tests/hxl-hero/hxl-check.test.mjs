// Checks the HXL Hero's checker against two fixture projects: one whose chain
// is complete and must stay silent, and one that breaks every rule once.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apexCode,
  check,
  classBody,
  discover,
  findRoot,
  invocableOutputs,
  invocableVariables
} from '../../plugins/hxl-hero/skills/salesforce-hxl-hero/scripts/hxl-check.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const findingsOf = (project) => check(discover(findRoot(join(fixtures, project))));
const rulesOf = (findings) => new Set(findings.map((f) => f.rule));

describe('Apex parsing', () => {
  test('keeps strings intact while removing comments', () => {
    const code = apexCode("String a = 'https://example.com'; // gone\n/* gone */ String b;");
    assert.match(code, /https:\/\/example\.com/);
    assert.doesNotMatch(code, /gone/);
  });

  test('reads the @InvocableVariable names of a class, with and without parameters', () => {
    const body = classBody(
      "class Response { @InvocableVariable(label='A (x)' description='b') global String first; @InvocableVariable global List<Row> rows; }",
      'Response'
    );
    assert.deepEqual(invocableVariables(body), ['first', 'rows']);
  });

  test('finds the response class from the List<...> return of the @InvocableMethod', () => {
    const source = `global class Tool {
      global class Response { @InvocableVariable global Integer total; }
      @InvocableMethod(label='Tool (beta)') global static List<Response> run(List<Request> r) { return null; }
    }`;
    assert.deepEqual(invocableOutputs(source), { responseClass: 'Response', outputs: ['total'] });
  });
});

describe('a complete chain', () => {
  test('maps tool, class, types and widget', () => {
    const map = discover(findRoot(join(fixtures, 'good-project')));
    assert.deepEqual(
      map.chains.map(({ tool, apexClass, envelope, response, widget }) => ({
        tool,
        apexClass,
        envelope,
        response,
        widget
      })),
      [
        {
          tool: 'getScoreBoard',
          apexClass: 'ScoreBoard',
          envelope: 'scoreBoard',
          response: 'scoreBoardResponse',
          widget: 'scoreBoardWidget'
        }
      ]
    );
    assert.equal(map.scratchDefHxl, true);
  });

  test('has no findings', () => {
    assert.deepEqual(findingsOf('good-project'), []);
  });
});

describe('a broken chain', () => {
  const findings = findingsOf('broken-project');
  const rules = rulesOf(findings);

  for (const rule of [
    'widget-files',
    'widget-binding',
    'widget-if-boolean',
    'widget-button-action',
    'widget-list-items',
    'type-list',
    'type-apex-ref',
    'type-response-outputs',
    'type-mcp-tag',
    'type-unevaluated',
    'renderer-outputvalues',
    'renderer-binding',
    'mcp-ui-resource',
    'mcp-one-request',
    'mcp-tool-class',
    'apex-sharing',
    'apex-user-mode',
    'access-class',
    'hxl-setting',
    'eca-contact',
    'eca-scope',
    'eca-pkce',
    'eca-callback',
    'eca-consumer-key'
  ]) {
    test(`reports ${rule}`, () => assert.ok(rules.has(rule), `${rule} missing in ${[...rules].join(', ')}`));
  }

  test('names invented and missing outputs of the response type', () => {
    const finding = findings.find((f) => f.rule === 'type-response-outputs');
    assert.match(finding.message, /not an output: rank/);
    assert.match(finding.message, /missing: total/);
  });

  test('a description that asks for one call per game counts as one request per call', () => {
    const tools = findings.filter((f) => f.rule === 'mcp-one-request').map((f) => f.message);
    assert.equal(tools.length, 1);
    assert.match(tools[0], /getLeaders/);
  });

  test('suppresses a finding listed with a reason in .hxl-check-ignore, but not one without', () => {
    assert.equal(rules.has('mcp-hints'), false);
    assert.ok(findings.some((f) => f.rule === 'widget-files' && f.message.includes('ignoredWidget')));
  });

  test('only errors with errorsOnly', () => {
    const errors = check(discover(findRoot(join(fixtures, 'broken-project'))), { errorsOnly: true });
    assert.ok(errors.length > 0);
    assert.ok(errors.every((f) => f.severity === 'error'));
  });
});
