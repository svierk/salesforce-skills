// Checks the decisions of the HXL Hero's preflight against the values an org
// returns - the calls to the Salesforce CLI around them need a real org and are
// tried by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkApiVersion,
  checkHxlSetting,
  checkMetadataTypes,
  checkOrgType,
  hxlEnabledIn
} from '../../plugins/hxl-hero/skills/salesforce-hxl-hero/scripts/preflight.mjs';

test('names a production org and accepts scratch orgs, sandboxes and developer orgs', () => {
  assert.equal(checkOrgType({ IsSandbox: false, OrganizationType: 'Enterprise Edition' }).production, true);
  assert.equal(checkOrgType({ IsSandbox: true, TrialExpirationDate: '2026-12-01' }).text, 'Scratch or trial org');
  assert.equal(checkOrgType({ IsSandbox: true, OrganizationType: 'Unlimited Edition' }).text, 'Sandbox');
  assert.equal(checkOrgType({ IsSandbox: false, OrganizationType: 'Developer Edition' }).ok, true);
});

test('needs API version 67.0', () => {
  assert.equal(checkApiVersion('67.0').ok, true);
  assert.equal(checkApiVersion('66.0').ok, false);
});

test('tells a missing setting from one that is off, on or unread', () => {
  assert.match(checkHxlSetting({ hasSetting: false }).text, /no Headless Experience Layer setting/);
  assert.equal(checkHxlSetting({ hasSetting: true, enabled: true }).ok, true);
  assert.match(checkHxlSetting({ hasSetting: true, enabled: false }).text, /is off/);
  assert.match(checkHxlSetting({ hasSetting: true, enabled: undefined }).text, /Could not read/);
});

test('reads hxlEnabled from the retrieved setting', () => {
  assert.equal(hxlEnabledIn('<UiWidgetSettings><hxlEnabled>true</hxlEnabled></UiWidgetSettings>'), true);
  assert.equal(hxlEnabledIn('<UiWidgetSettings><hxlEnabled>false</hxlEnabled></UiWidgetSettings>'), false);
  assert.equal(hxlEnabledIn('<UiWidgetSettings/>'), undefined);
});

test('explains a missing UiWidgetBundle by the HXL setting', () => {
  const [widgets, servers, signIn] = checkMetadataTypes(['McpServerDefinition', 'ExternalClientApplication'], false);
  assert.equal(widgets.ok, false);
  assert.match(widgets.hint, /once HXL is on/);
  assert.equal(servers.ok, true);
  assert.equal(signIn.ok, true);
  assert.equal(checkMetadataTypes([], true)[1].ok, false);
});
