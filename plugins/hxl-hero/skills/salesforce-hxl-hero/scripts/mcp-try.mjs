#!/usr/bin/env node
// Tries a custom Salesforce MCP server the way a client does - without the
// client. Runs from a workspace outside the user's repository with
// playwright-core and the installed Google Chrome (copy this file there).
//
//   node mcp-try.mjs login  --target-org <alias> --client-id <id> [--callback <url>]
//   node mcp-try.mjs tools  --server-url <url>
//   node mcp-try.mjs call   --server-url <url> --tool <name> --args '<json>'
//   node mcp-try.mjs render --server-url <url> --tool <name> --args '<json>' --out <png> [--theme light|dark]
//
// login   signs in with the PKCE authorization-code flow against the org's
//         External Client App: the org's frontdoor URL is opened in-process and
//         never printed, the redirect to the client's callback (Claude's by
//         default - it must be one of the app's callback URLs) is intercepted,
//         and the token is written to .mcp-token.json with owner-only rights.
//         Nothing secret is printed.
// tools   lists the tools the signed-in user sees, with their widget resource.
// call    calls one tool and prints its structured result.
// render  calls one tool, loads its ui:// resource - Salesforce's widget
//         renderer, the same the client embeds - into a minimal MCP Apps host
//         and takes a screenshot of the widget.

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_FILE = '.mcp-token.json';
export const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const PROTOCOL_VERSION = '2025-06-18';

// ------------------------------------------------------------- the decisions

export function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export function authorizeUrl({ instance, clientId, callback, challenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callback,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'mcp_api refresh_token'
  });
  return `${instance}/services/oauth2/authorize?${params}`;
}

/** A JSON-RPC reply as plain JSON or as server-sent events. */
export function parseRpcBody(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const data = /^(event|data|id):/m.test(trimmed.split('\n')[0])
    ? trimmed
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
    : trimmed;
  return JSON.parse(data);
}

/** Number of requests in a call's arguments - more than one renders no widget. */
export function requestCount(args) {
  return Array.isArray(args?.inputs) ? args.inputs.length : 0;
}

/**
 * A minimal MCP Apps host: answers ui/initialize with the theme, then sends
 * the tool input and result, and sizes the frame as the app asks.
 */
export function hostPage({ html, args, result, theme = 'light', width = 640 }) {
  const background = theme === 'dark' ? '#16161d' : '#f4f4f6';
  const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:${background}">
<iframe id="app" sandbox="allow-scripts allow-same-origin allow-forms" style="width:${width}px;height:120px;border:0;border-radius:12px"></iframe>
<script>
const frame = document.getElementById('app');
const send = (msg) => frame.contentWindow.postMessage({ jsonrpc: '2.0', ...msg }, '*');
window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  const m = event.data || {};
  if (!m.method) return;
  window.hostEvent && window.hostEvent({ method: m.method, params: m.params });
  if (m.method === 'ui/initialize') {
    send({ id: m.id, result: { protocolVersion: (m.params && m.params.protocolVersion) || '${PROTOCOL_VERSION}',
      hostInfo: { name: 'hxl-hero mcp-try', version: '0.0.0' },
      hostCapabilities: { openLinks: {}, serverTools: {}, serverResources: {}, logging: {} },
      hostContext: { theme: '${theme}', displayMode: 'inline', availableDisplayModes: ['inline'],
        containerDimensions: { width: ${width}, maxHeight: 4000 }, locale: 'en-US', platform: 'web' } } });
  } else if (m.method === 'ui/notifications/initialized') {
    send({ method: 'ui/notifications/tool-input', params: { arguments: ${json(args)} } });
    send({ method: 'ui/notifications/tool-result', params: ${json(result)} });
  } else if (m.method === 'ui/notifications/size-changed') {
    if (m.params && m.params.height) frame.style.height = Math.ceil(m.params.height) + 'px';
  } else if (m.id !== undefined) {
    send({ id: m.id, result: {} });
  }
});
frame.srcdoc = ${json(html)};
</script></body></html>`;
}

export function parseArgs(argv) {
  const value = (name) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  return {
    command: argv[0],
    targetOrg: value('--target-org') ?? value('-o'),
    clientId: value('--client-id'),
    callback: value('--callback') ?? CLAUDE_CALLBACK,
    serverUrl: value('--server-url'),
    tool: value('--tool'),
    args: value('--args'),
    out: value('--out'),
    theme: value('--theme') ?? 'light',
    tokenFile: value('--token-file') ?? TOKEN_FILE
  };
}

// ----------------------------------------------------------------- the client

async function chrome() {
  let playwright;
  try {
    playwright = await import('playwright-core');
  } catch {
    console.error(
      'playwright-core not found - run this from a workspace with "npm install playwright-core" (see testing.md).'
    );
    process.exit(2);
  }
  return playwright.chromium.launch({ channel: 'chrome', headless: true });
}

async function login({ targetOrg, clientId, callback, tokenFile }) {
  if (!targetOrg || !clientId) throw new Error('login needs --target-org and --client-id');
  const { url: frontdoor } = JSON.parse(
    execFileSync('sf', ['org', 'open', '--url-only', '--target-org', targetOrg, '--json'], { encoding: 'utf8' })
  ).result;
  const instance = new URL(frontdoor).origin;
  const { verifier, challenge } = pkcePair();

  const browser = await chrome();
  const page = await browser.newPage();
  let code;
  await page.route(`${new URL(callback).origin}/**`, (route) => {
    code = new URL(route.request().url()).searchParams.get('code');
    route.fulfill({ status: 200, body: 'captured' });
  });
  await page.goto(frontdoor);
  await page.waitForURL(/lightning|ChangePassword|AddPhoneNumber|setup|home/, { timeout: 60000 }).catch(() => {});
  await page.goto(authorizeUrl({ instance, clientId, callback, challenge }));
  for (let i = 0; i < 20 && !code; i++) {
    const allow = page.getByRole('button', { name: /^(Allow|Zulassen)$/ });
    if (await allow.isVisible().catch(() => false)) await allow.click();
    await page.waitForTimeout(1000);
  }
  const landed = new URL(page.url()).pathname;
  await browser.close();
  if (!code) {
    throw new Error(
      `No authorization code - the browser stopped at ${landed}. A new user may have to change the password first ` +
        "(sf org generate password), the callback may not be one of the app's callback URLs, or the app is not ready yet (up to 30 minutes)."
    );
  }

  const response = await fetch(`${instance}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: callback,
      code_verifier: verifier
    })
  });
  const token = await response.json();
  if (!token.access_token)
    throw new Error(`Token exchange failed: ${token.error ?? response.status} ${token.error_description ?? ''}`);
  writeFileSync(tokenFile, JSON.stringify({ ...token, client_id: clientId }), { mode: 0o600 });
  console.log(
    `Signed in to ${instance} as the user of ${targetOrg}; token in ${tokenFile} (owner-only, do not commit).`
  );
}

function session(serverUrl, tokenFile) {
  if (!serverUrl) throw new Error('--server-url is required');
  const { access_token: accessToken } = JSON.parse(readFileSync(tokenFile, 'utf8'));
  let sessionId;
  let id = 0;
  const rpc = async (method, params, notify = false) => {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
      },
      body: JSON.stringify(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params })
    });
    sessionId = response.headers.get('mcp-session-id') ?? sessionId;
    if (response.status === 401) throw new Error('401 - the token expired or belongs to another org; run login again');
    const body = parseRpcBody(await response.text());
    if (body?.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
    return body?.result;
  };
  return {
    rpc,
    async open() {
      await rpc('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } },
        clientInfo: { name: 'hxl-hero mcp-try', version: '0.0.0' }
      });
      await rpc('notifications/initialized', {}, true);
    }
  };
}

async function tools({ serverUrl, tokenFile }) {
  const s = session(serverUrl, tokenFile);
  await s.open();
  const { tools: list = [] } = await s.rpc('tools/list', {});
  if (!list.length)
    console.log('No tools - the signed-in user may lack the permission set that grants the tool classes.');
  for (const tool of list) console.log(`${tool.name}  →  ${tool._meta?.ui?.resourceUri ?? 'no widget'}`);
}

async function callTool(s, tool, argsJson) {
  const args = JSON.parse(argsJson ?? '{"inputs":[{}]}');
  if (requestCount(args) > 1)
    console.warn('Several requests in one call - the widget renders only for a single request.');
  return { args, result: await s.rpc('tools/call', { name: tool, arguments: args }) };
}

async function call({ serverUrl, tokenFile, tool, args: argsJson }) {
  const s = session(serverUrl, tokenFile);
  await s.open();
  const { result } = await callTool(s, tool, argsJson);
  if (result.isError) console.log(`Error: ${result.content?.map((c) => c.text).join(' ')}`);
  console.log(JSON.stringify(result.structuredContent ?? result.content, null, 2));
}

async function render({ serverUrl, tokenFile, tool, args: argsJson, out, theme }) {
  if (!out) throw new Error('render needs --out <png>');
  const s = session(serverUrl, tokenFile);
  await s.open();
  const { tools: list = [] } = await s.rpc('tools/list', {});
  const uri = list.find((t) => t.name === tool)?._meta?.ui?.resourceUri;
  if (!uri) throw new Error(`Tool ${tool} is not listed for this user, or it has no widget resource`);
  const html = (await s.rpc('resources/read', { uri })).contents[0].text;
  const { args, result } = await callTool(s, tool, argsJson);

  const browser = await chrome();
  const page = await browser.newPage({
    viewport: { width: 720, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: theme
  });
  const events = [];
  await page.exposeFunction('hostEvent', (event) => events.push(event));
  await page.setContent(hostPage({ html, args, result, theme }));
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const sizes = events.filter((e) => e.method === 'ui/notifications/size-changed');
    if (sizes.length && sizes.length === last && i > 6) break;
    last = sizes.length;
  }
  const box = await page.locator('#app').boundingBox();
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 688, height: Math.ceil(box.y + box.height + 24) } });
  await browser.close();
  console.log(`Events: ${events.map((e) => e.method.replace('ui/notifications/', '')).join(', ')}`);
  console.log(`Screenshot: ${out}`);
}

async function main(argv) {
  const options = parseArgs(argv);
  const commands = { login, tools, call, render };
  if (!commands[options.command]) {
    console.error('Usage: mcp-try.mjs login|tools|call|render [options] - see the header of this file.');
    process.exit(2);
  }
  try {
    await commands[options.command](options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
