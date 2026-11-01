// Checks the pieces of the HXL Hero's MCP client that need no org and no
// browser: PKCE, the authorize URL, JSON-RPC replies and the MCP Apps host page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  authorizeUrl,
  CLAUDE_CALLBACK,
  hostPage,
  parseArgs,
  parseRpcBody,
  pkcePair,
  requestCount
} from '../../plugins/hxl-hero/skills/salesforce-hxl-hero/scripts/mcp-try.mjs';

test('derives the PKCE challenge from the verifier with S256', () => {
  const { verifier, challenge } = pkcePair();
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(pkcePair().verifier, verifier);
});

test('asks for the MCP and refresh token scopes with the client callback', () => {
  const url = new URL(
    authorizeUrl({ instance: 'https://x.my.salesforce.com', clientId: 'id', callback: CLAUDE_CALLBACK, challenge: 'c' })
  );
  assert.equal(url.pathname, '/services/oauth2/authorize');
  assert.equal(url.searchParams.get('scope'), 'mcp_api refresh_token');
  assert.equal(url.searchParams.get('redirect_uri'), CLAUDE_CALLBACK);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('reads JSON-RPC replies as JSON and as server-sent events', () => {
  assert.deepEqual(parseRpcBody('{"result":{"a":1}}'), { result: { a: 1 } });
  assert.deepEqual(parseRpcBody('event: message\ndata: {"result":{"a":2}}\n\n'), { result: { a: 2 } });
  assert.equal(parseRpcBody(''), null);
});

test('counts the requests of a call - more than one renders no widget', () => {
  assert.equal(requestCount({ inputs: [{}] }), 1);
  assert.equal(requestCount({ inputs: [{ period: 'week' }, { period: 'all' }] }), 2);
  assert.equal(requestCount({ game: 'snake' }), 0);
});

test('the host page answers ui/initialize with the theme and cannot be broken out of by the payload', () => {
  const page = hostPage({ html: '<script>x</script>', args: { inputs: [{}] }, result: { content: [] }, theme: 'dark' });
  assert.match(page, /theme: 'dark'/);
  assert.match(page, /ui\/notifications\/tool-result/);
  assert.doesNotMatch(page, /<script>x<\/script>/);
});

test("defaults to Claude's callback and the light theme", () => {
  const options = parseArgs(['login', '--target-org', 'dev', '--client-id', 'id']);
  assert.equal(options.callback, CLAUDE_CALLBACK);
  assert.equal(parseArgs(['render']).theme, 'light');
});
