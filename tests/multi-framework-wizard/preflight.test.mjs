// Checks the decisions of the Multi-Framework Wizard's preflight against the
// values an org returns - the calls to the Salesforce CLI around them need a
// real org and are tried by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkApiVersion,
  checkEdgeNetwork,
  checkInstance,
  checkLanguage,
  checkMultiFramework,
  checkOrgType
} from '../../plugins/multi-framework-wizard/skills/salesforce-multi-framework-wizard/scripts/preflight.mjs';

describe('org type', () => {
  test('names a production org', () => {
    const finding = checkOrgType({
      IsSandbox: false,
      OrganizationType: 'Enterprise Edition',
      TrialExpirationDate: null
    });
    assert.equal(finding.ok, false);
    assert.equal(finding.production, true);
  });

  test('accepts scratch orgs, which report IsSandbox too, sandboxes and developer orgs', () => {
    const scratch = checkOrgType({
      IsSandbox: true,
      OrganizationType: 'Developer Edition',
      TrialExpirationDate: '2026-11-01T00:00:00.000+0000'
    });
    assert.equal(scratch.text, 'Scratch or trial org');
    assert.equal(checkOrgType({ IsSandbox: true, OrganizationType: 'Unlimited Edition' }).text, 'Sandbox');
    assert.equal(checkOrgType({ IsSandbox: false, OrganizationType: 'Developer Edition' }).ok, true);
  });
});

describe('API version', () => {
  test('only reports the version without a minimum', () => {
    assert.deepEqual(checkApiVersion('68.0'), { ok: true, id: 'api-version', text: 'API version 68.0' });
  });

  test('compares with the minimum the design needs', () => {
    assert.equal(checkApiVersion('68.0', '67.0').ok, true);
    assert.equal(checkApiVersion('66.0', '67.0').ok, false);
  });
});

test('Multi-Framework is available when the org knows the UIBundle type', () => {
  assert.equal(checkMultiFramework([{ xmlName: 'ApexClass' }, { xmlName: 'UIBundle' }]).ok, true);
  assert.equal(checkMultiFramework([{ xmlName: 'ApexClass' }]).ok, false);
});

test('Hyperforce instances have three letters before the number', () => {
  for (const name of ['SWE44S', 'USA244S', 'DEU12S']) assert.equal(checkInstance(name).ok, true, name);
  for (const name of ['NA123', 'EU45', 'CS42', undefined]) assert.equal(checkInstance(name).ok, false, String(name));
});

test('embedding needs English as the default language', () => {
  assert.equal(checkLanguage('en_US').ok, true);
  assert.equal(checkLanguage('en_GB').ok, true);
  assert.equal(checkLanguage('de').ok, false);
});

test('the Edge Network is read from the My Domain settings', () => {
  assert.equal(checkEdgeNetwork('<MyDomainSettings><useEdge>true</useEdge></MyDomainSettings>').ok, true);
  assert.equal(checkEdgeNetwork('<MyDomainSettings><useEdge>false</useEdge></MyDomainSettings>').ok, false);
  assert.equal(checkEdgeNetwork('<MyDomainSettings/>').ok, false);
});
