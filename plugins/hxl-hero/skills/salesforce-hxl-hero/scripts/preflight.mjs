#!/usr/bin/env node
// Checks whether an org can run HXL widgets through a custom MCP server before
// anything is deployed. Read-only: one query, the lists of metadata types and
// settings, and a retrieve of the HXL setting into a temporary folder outside
// the project, so source tracking stays untouched.
//
//   node preflight.mjs [--target-org <alias>] [--json]
//
//   Org type      production orgs are named - the skill does not deploy there
//   API version   67.0 or later (Winter '27 brought HXL and hosted MCP servers)
//   HXL setting   the org has Settings:UiWidget, and whether hxlEnabled is on
//   Widgets       the org lists UiWidgetBundle - only once HXL is on
//   MCP servers   the org knows McpServerDefinition
//   Sign-in       the org knows ExternalClientApplication
//
// Every finding is a warning with a hint, never a blocker. The exit code is 1
// only when the org cannot be reached.

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const MIN_API = 67;

// ----------------------------------------------------------------- the checks

/** Production orgs are named first: the skill deploys to scratch orgs, sandboxes and developer orgs only. */
export function checkOrgType({ IsSandbox, OrganizationType, TrialExpirationDate }) {
  if (TrialExpirationDate) return { ok: true, id: 'org-type', text: 'Scratch or trial org' };
  if (IsSandbox) return { ok: true, id: 'org-type', text: 'Sandbox' };
  if (/Developer Edition/i.test(OrganizationType ?? '')) return { ok: true, id: 'org-type', text: 'Developer Edition' };
  return {
    ok: false,
    id: 'org-type',
    production: true,
    text: `Production org (${OrganizationType})`,
    hint: 'Set up HXL in a scratch org, sandbox or developer org first; production gets it through the pipeline.'
  };
}

export function checkApiVersion(apiVersion) {
  return Number(apiVersion) >= MIN_API
    ? { ok: true, id: 'api-version', text: `API version ${apiVersion}` }
    : {
        ok: false,
        id: 'api-version',
        text: `API version ${apiVersion} is older than ${MIN_API}.0`,
        hint: "HXL and hosted MCP servers need Winter '27 or later. Use an org on a newer release."
      };
}

/** hasSetting: the org lists Settings:UiWidget; enabled: its hxlEnabled value, undefined when unread. */
export function checkHxlSetting({ hasSetting, enabled }) {
  if (!hasSetting) {
    return {
      ok: false,
      id: 'hxl-setting',
      text: 'The org has no Headless Experience Layer setting',
      hint: 'This release or edition has no HXL. Use an org on a release with the HXL beta.'
    };
  }
  if (enabled) return { ok: true, id: 'hxl-setting', text: 'Headless Experience Layer is on' };
  return {
    ok: false,
    id: 'hxl-setting',
    text: enabled === false ? 'Headless Experience Layer is off' : 'Could not read whether HXL is on',
    hint: 'Turn it on before the deploy with widgets: deploy Settings:UiWidget (hxlEnabled) on its own, or use Setup > Headless Experience Layer Settings. It accepts the beta terms for the org - ask first.'
  };
}

export function checkMetadataTypes(typeNames, hxlOn) {
  const has = (name) => typeNames.includes(name);
  return [
    has('UiWidgetBundle')
      ? { ok: true, id: 'widgets', text: 'UiWidgetBundle available' }
      : {
          ok: false,
          id: 'widgets',
          text: 'The org does not list UiWidgetBundle',
          hint: hxlOn ? 'HXL is on but widgets are missing - check the release.' : 'Listed once HXL is on.'
        },
    has('McpServerDefinition')
      ? { ok: true, id: 'mcp-servers', text: 'MCP server definitions available' }
      : {
          ok: false,
          id: 'mcp-servers',
          text: 'The org does not know McpServerDefinition',
          hint: 'No Salesforce Hosted MCP servers in this org - widgets cannot reach Claude, ChatGPT or Slackbot.'
        },
    has('ExternalClientApplication')
      ? { ok: true, id: 'sign-in', text: 'External Client Apps available' }
      : {
          ok: false,
          id: 'sign-in',
          text: 'The org does not know ExternalClientApplication',
          hint: 'MCP clients sign in through an External Client App; without one they cannot connect.'
        }
  ];
}

export function hxlEnabledIn(settingsXml) {
  const match = settingsXml.match(/<hxlEnabled>\s*(true|false)\s*<\/hxlEnabled>/);
  return match ? match[1] === 'true' : undefined;
}

// ------------------------------------------------------------------ the org

async function sf(args, orgArgs, options = {}) {
  const { stdout } = await promisify(execFile)('sf', [...args, ...orgArgs, '--json'], {
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  return JSON.parse(stdout).result;
}

function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(path, name);
      if (found) return found;
    } else if (entry.name === name) return path;
  }
  return undefined;
}

async function readHxlSetting(orgArgs) {
  const dir = mkdtempSync(join(tmpdir(), 'hxl-preflight-'));
  try {
    await sf(
      ['project', 'retrieve', 'start', '--metadata', 'Settings:UiWidget', '--target-metadata-dir', dir, '--unzip'],
      orgArgs,
      { cwd: dir }
    );
    const file = findFile(dir, 'UiWidget.settings');
    return file ? hxlEnabledIn(readFileSync(file, 'utf8')) : undefined;
  } catch {
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(argv) {
  const at = argv.findIndex((a) => a === '--target-org' || a === '-o');
  let orgArgs = at >= 0 ? ['--target-org', argv[at + 1]] : [];
  let org;
  try {
    org = await sf(['org', 'display'], orgArgs);
  } catch (error) {
    console.error(
      `Could not reach the org (${error.message.split('\n')[0]}). Log in with sf org login web, or pass --target-org.`
    );
    process.exit(1);
  }
  // Pin the username: the retrieve runs outside the project, where a project default org is unknown.
  orgArgs = ['--target-org', org.username];

  const [info] = (
    await sf(
      ['data', 'query', '--query', 'SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization'],
      orgArgs
    )
  ).records;
  const types = (await sf(['org', 'list', 'metadata-types'], orgArgs)).metadataObjects.map((t) => t.xmlName);
  const settings = (await sf(['org', 'list', 'metadata', '--metadata-type', 'Settings'], orgArgs)) ?? [];
  const hasSetting = settings.some((s) => s.fullName === 'UiWidget');
  const enabled = hasSetting ? await readHxlSetting(orgArgs) : undefined;

  const findings = [
    checkOrgType(info),
    checkApiVersion(org.apiVersion),
    checkHxlSetting({ hasSetting, enabled }),
    ...checkMetadataTypes(types, enabled === true)
  ];
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ org: org.alias ?? org.username, findings }, null, 2));
    return;
  }
  console.log(`HXL preflight of ${org.alias ?? org.username}\n`);
  for (const finding of findings) {
    console.log(`${finding.ok ? '✓' : '⚠'} ${finding.text}`);
    if (finding.hint) console.log(`    → ${finding.hint}`);
  }
  const gaps = findings.filter((f) => !f.ok).length;
  console.log(gaps ? `\n${gaps} gap(s) - see the hints above.` : '\nThe org is ready for HXL.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
