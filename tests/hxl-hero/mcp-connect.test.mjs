// Checks the decisions of the HXL Hero's connect script - the Tooling API calls
// around them need a real org and are tried by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activationStep,
  consumerKeyIn,
  parseArgs,
  serverUrl
} from '../../plugins/hxl-hero/skills/salesforce-hxl-hero/scripts/mcp-connect.mjs';

test('uses the sandbox URL for sandboxes and scratch orgs', () => {
  assert.equal(serverUrl('arcade', true), 'https://api.salesforce.com/platform/mcp/v1/sandbox/custom/arcade');
  assert.equal(serverUrl('arcade', false), 'https://api.salesforce.com/platform/mcp/v1/custom/arcade');
});

test('creates the access record, sets it active, or leaves it', () => {
  assert.equal(activationStep(undefined), 'create');
  assert.equal(activationStep({ Id: '1fz', Active: false }), 'update');
  assert.equal(activationStep({ Id: '1fz', Active: true }), 'none');
});

test('reads the consumer key from retrieved global OAuth settings', () => {
  assert.equal(consumerKeyIn('<x><consumerKey>3MVGabc</consumerKey></x>'), '3MVGabc');
  assert.equal(consumerKeyIn('<x></x>'), undefined);
});

test('changes nothing without --activate', () => {
  assert.equal(parseArgs(['--target-org', 'dev', '--server', 'arcade']).activate, false);
  assert.equal(parseArgs(['-o', 'dev', '--server', 'arcade', '--activate']).targetOrg, 'dev');
});
