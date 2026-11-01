#!/usr/bin/env node
// Reports - and with --activate, turns on - a custom MCP server, and prints
// what an MCP client needs to connect: the server URL and the OAuth client ID
// of the External Client App. The way Polyglot Arcade's connect step does it.
//
//   node mcp-connect.mjs --target-org <alias> --server <name>
//                        [--oauth-settings <eca>_glbloauth] [--activate] [--json]
//
// An MCP server is active when a Tooling API record McpServerAccess with
// Active = true points at its McpServerDefinition - the definition has no
// active flag. Without --activate the script changes nothing. The client ID is
// the consumer key of the External Client App, read with a retrieve into a
// temporary folder outside the project; it is a public identifier.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------- the decisions

/** Sandboxes and scratch orgs (IsSandbox) sign in at test.salesforce.com and use the sandbox URL. */
export function serverUrl(name, isSandbox) {
  return `https://api.salesforce.com/platform/mcp/v1/${isSandbox ? 'sandbox/' : ''}custom/${name}`;
}

/** What activation needs: create a record, set Active, or nothing. */
export function activationStep(access) {
  if (!access) return 'create';
  return access.Active ? 'none' : 'update';
}

export function consumerKeyIn(globalOauthXml) {
  return globalOauthXml.match(/<consumerKey>\s*([^<\s]+)\s*<\/consumerKey>/)?.[1];
}

export function parseArgs(argv) {
  const value = (...names) => {
    const at = argv.findIndex((a) => names.includes(a));
    return at >= 0 ? argv[at + 1] : undefined;
  };
  return {
    targetOrg: value('--target-org', '-o'),
    server: value('--server'),
    oauthSettings: value('--oauth-settings'),
    activate: argv.includes('--activate'),
    json: argv.includes('--json')
  };
}

// ------------------------------------------------------------------ the org

function sf(args, orgArgs, options = {}) {
  const out = execFileSync('sf', [...args, ...orgArgs, '--json'], { encoding: 'utf8', ...options });
  return JSON.parse(out).result;
}

function findFile(dir, suffix) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(path, suffix);
      if (found) return found;
    } else if (entry.name.endsWith(suffix)) return path;
  }
  return undefined;
}

function readClientId(name, orgArgs) {
  const dir = mkdtempSync(join(tmpdir(), 'hxl-eca-'));
  try {
    sf(
      [
        'project',
        'retrieve',
        'start',
        '--metadata',
        `ExtlClntAppGlobalOauthSettings:${name}`,
        '--target-metadata-dir',
        dir,
        '--unzip'
      ],
      orgArgs,
      { cwd: dir }
    );
    const file = findFile(dir, '.ecaGlblOauth');
    return file ? consumerKeyIn(readFileSync(file, 'utf8')) : undefined;
  } catch {
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.targetOrg || !args.server) {
    console.error(
      'Usage: mcp-connect.mjs --target-org <alias> --server <name> [--oauth-settings <eca>_glbloauth] [--activate] [--json]'
    );
    process.exit(2);
  }
  const org = sf(['org', 'display'], ['--target-org', args.targetOrg]);
  // Pin the username: the retrieve runs outside the project.
  const orgArgs = ['--target-org', org.username];

  const definition = sf(
    [
      'data',
      'query',
      '--use-tooling-api',
      '--query',
      `SELECT Id FROM McpServerDefinition WHERE DeveloperName = '${args.server}'`
    ],
    orgArgs
  ).records[0];
  if (!definition) {
    console.error(`MCP server ${args.server} not found in the org - deploy its McpServerDefinition first.`);
    process.exit(1);
  }
  const access = sf(
    [
      'data',
      'query',
      '--use-tooling-api',
      '--query',
      `SELECT Id, Active FROM McpServerAccess WHERE McpServerId = '${definition.Id}'`
    ],
    orgArgs
  ).records[0];
  const step = activationStep(access);
  let active = step === 'none';
  if (args.activate && step === 'create') {
    sf(
      [
        'data',
        'create',
        'record',
        '--use-tooling-api',
        '--sobject',
        'McpServerAccess',
        '--values',
        `DeveloperName=${args.server} MasterLabel='${args.server}' Active=true McpServerId=${definition.Id}`
      ],
      orgArgs
    );
    active = true;
  } else if (args.activate && step === 'update') {
    sf(
      [
        'data',
        'update',
        'record',
        '--use-tooling-api',
        '--sobject',
        'McpServerAccess',
        '--record-id',
        access.Id,
        '--values',
        'Active=true'
      ],
      orgArgs
    );
    active = true;
  }

  const [{ IsSandbox }] = sf(['data', 'query', '--query', 'SELECT IsSandbox FROM Organization'], orgArgs).records;
  const url = serverUrl(args.server, IsSandbox);
  const clientId = args.oauthSettings ? readClientId(args.oauthSettings, orgArgs) : undefined;

  if (args.json) {
    console.log(JSON.stringify({ server: args.server, active, url, clientId: clientId ?? null }, null, 2));
    return;
  }
  console.log(`MCP server ${args.server}: ${active ? 'active' : 'not active - run again with --activate after a yes'}`);
  console.log(`  Server URL:       ${url}`);
  if (args.oauthSettings)
    console.log(`  OAuth client ID:  ${clientId ?? `(not readable - see External Client App Manager)`}`);
  console.log('  A new External Client App can take up to 30 minutes before sign-in works.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
