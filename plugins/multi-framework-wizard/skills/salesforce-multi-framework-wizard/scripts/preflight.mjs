#!/usr/bin/env node
// Checks whether an org can run a Salesforce Multi-Framework app before
// anything is deployed, the way Polyglot Arcade's setup does. Read-only: two
// queries, the list of metadata types and a retrieve of the My Domain settings
// into a temporary folder outside the project, so source tracking stays
// untouched.
//
//   node preflight.mjs [--target-org <alias>] [--min-api <version>] [--json]
//
//   Org type        production orgs are named - the skill does not deploy there
//   API version     reported; compared with --min-api when the design needs a release
//   Multi-Framework the org knows the UIBundle metadata type
//   Hyperforce      instance name like USA244S (heuristic - there is no query for it)
//   Language        English as the default language (lightning-ui-embedding)
//   Edge Network    MyDomainSettings.useEdge (UI bundles open from the App Launcher)
//
// Every finding is a warning with a hint, never a blocker: some orgs work with
// a gap, and the checks cannot see everything. The exit code is 1 only when the
// org cannot be reached.

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

// Hyperforce instances are named <three letters><number>, mostly with a trailing S
// (USA244S, SWE44S); first-generation instances have two letters (NA123, EU45, CS42).
const HYPERFORCE_INSTANCE = /^[A-Z]{3}\d+[A-Z]?$/i;

// ----------------------------------------------------------------- the checks

/** Production orgs are named first: the skill deploys to scratch orgs, sandboxes and developer orgs only. */
export function checkOrgType({ IsSandbox, OrganizationType, TrialExpirationDate }) {
  // Scratch orgs report IsSandbox too; their expiry date tells them apart.
  if (TrialExpirationDate) return { ok: true, id: 'org-type', text: 'Scratch or trial org' };
  if (IsSandbox) return { ok: true, id: 'org-type', text: 'Sandbox' };
  if (/Developer Edition/i.test(OrganizationType ?? '')) return { ok: true, id: 'org-type', text: 'Developer Edition' };
  return {
    ok: false,
    id: 'org-type',
    production: true,
    text: `Production org (${OrganizationType})`,
    hint: 'Deploy and set up in a scratch org, sandbox or developer org first. Nothing in this skill deploys to production.'
  };
}

export function checkApiVersion(apiVersion, minApi) {
  if (!minApi) return { ok: true, id: 'api-version', text: `API version ${apiVersion}` };
  return Number(apiVersion) >= Number(minApi)
    ? { ok: true, id: 'api-version', text: `API version ${apiVersion} (${minApi} needed)` }
    : {
        ok: false,
        id: 'api-version',
        text: `API version ${apiVersion} is older than ${minApi}`,
        hint: 'The design needs a newer release. Use an org on that release, or a preview sandbox or scratch org.'
      };
}

export function checkMultiFramework(metadataObjects) {
  return metadataObjects.some((type) => type.xmlName === 'UIBundle')
    ? { ok: true, id: 'multi-framework', text: 'Salesforce Multi-Framework available (UIBundle metadata type)' }
    : {
        ok: false,
        id: 'multi-framework',
        text: 'The org does not know the UIBundle metadata type',
        hint: 'Salesforce Multi-Framework is not available in this org, so a deploy of UI bundles fails. Check the edition, Hyperforce and the release.'
      };
}

export function checkInstance(instanceName) {
  return HYPERFORCE_INSTANCE.test(instanceName ?? '')
    ? { ok: true, id: 'hyperforce', text: `Hyperforce instance ${instanceName}` }
    : {
        ok: false,
        id: 'hyperforce',
        text: `Instance ${instanceName} does not look like Hyperforce`,
        hint: 'Multi-Framework and lightning-ui-embedding need a Hyperforce org. Check the instance in Setup > Company Information.'
      };
}

export function checkLanguage(languageLocaleKey) {
  return (languageLocaleKey ?? '').startsWith('en')
    ? { ok: true, id: 'language', text: `Default language ${languageLocaleKey}` }
    : {
        ok: false,
        id: 'language',
        text: `Default language ${languageLocaleKey} is not English`,
        hint: 'Embedded apps stay blank: lightning-ui-embedding needs English as the default language (Setup > Company Information). Standalone UI bundles work anyway.'
      };
}

export function checkEdgeNetwork(myDomainSettingsXml) {
  return /<useEdge>\s*true\s*<\/useEdge>/.test(myDomainSettingsXml)
    ? { ok: true, id: 'edge-network', text: 'Salesforce Edge Network enabled' }
    : {
        ok: false,
        id: 'edge-network',
        text: 'Salesforce Edge Network is not enabled',
        hint: 'UI bundles do not open from the App Launcher without it. Enable it in Setup > My Domain > Routing and Policies - an org-wide change, so agree it first.'
      };
}

// A check that cannot run turns into a manual check, not a failed preflight.
const manual = (id, label, hint) => (error) => ({
  ok: false,
  id,
  text: `Could not check ${label} (${String(error.message).split('\n')[0]})`,
  hint
});

// ----------------------------------------------------------------- the org

function parseArgs(argv) {
  const value = (...names) => {
    const index = argv.findIndex((arg) => names.includes(arg));
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return { targetOrg: value('--target-org', '-o'), minApi: value('--min-api'), json: argv.includes('--json') };
}

async function sf(argv, orgArgs, options = {}) {
  const { stdout } = await promisify(execFile)('sf', [...argv, ...orgArgs, '--json'], {
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
  return null;
}

async function myDomainSettings(orgArgs) {
  // MyDomainSettings has no query API; retrieve it into a throwaway folder,
  // outside the project so source tracking stays untouched.
  const dir = mkdtempSync(join(tmpdir(), 'mfw-preflight-'));
  try {
    await sf(
      ['project', 'retrieve', 'start', '--metadata', 'Settings:MyDomain', '--target-metadata-dir', dir, '--unzip'],
      orgArgs,
      { cwd: dir }
    );
    const file = findFile(dir, 'MyDomain.settings');
    if (!file) throw new Error('MyDomain.settings not in the retrieve');
    return readFileSync(file, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(argv) {
  const { targetOrg, minApi, json } = parseArgs(argv);
  let orgArgs = targetOrg ? ['--target-org', targetOrg] : [];
  let org;
  try {
    org = await sf(['org', 'display'], orgArgs);
  } catch (error) {
    console.error(`Could not connect to the org (${String(error.message).split('\n')[0]})`);
    console.error('Log in with sf org login web, or pass --target-org <alias>.');
    process.exit(1);
  }
  // Pin the resolved username: the retrieve runs outside the project, where a
  // project-local default org is unknown.
  orgArgs = ['--target-org', org.username];

  const organization = sf(
    [
      'data',
      'query',
      '--query',
      'SELECT Name, IsSandbox, OrganizationType, TrialExpirationDate, InstanceName, LanguageLocaleKey FROM Organization'
    ],
    orgArgs
  ).then(({ records }) => records[0]);

  const findings = await Promise.all([
    organization.then(checkOrgType, manual('org-type', 'the org type', 'Make sure this is not a production org.')),
    checkApiVersion(org.apiVersion, minApi),
    sf(['org', 'list', 'metadata-types'], orgArgs).then(
      ({ metadataObjects }) => checkMultiFramework(metadataObjects),
      manual('multi-framework', 'Multi-Framework', 'Make sure Salesforce Multi-Framework is available in the org.')
    ),
    organization.then(
      (o) => checkInstance(o.InstanceName),
      manual('hyperforce', 'the instance', 'Make sure the org runs on Hyperforce.')
    ),
    organization.then(
      (o) => checkLanguage(o.LanguageLocaleKey),
      manual('language', 'the default language', 'Make sure English is the default language if apps are embedded.')
    ),
    myDomainSettings(orgArgs).then(
      checkEdgeNetwork,
      manual('edge-network', 'the Edge Network', 'Make sure Salesforce Edge Network is enabled in Setup > My Domain.')
    )
  ]);

  if (json) {
    console.log(JSON.stringify({ username: org.username, instanceUrl: org.instanceUrl, findings }, null, 2));
    return;
  }
  console.log(`Preflight for ${org.username} (${org.instanceUrl})\n`);
  for (const finding of findings) {
    console.log(`${finding.ok ? '✓' : '⚠'} ${finding.text}`);
    if (finding.hint) console.log(`    → ${finding.hint}`);
  }
  const warnings = findings.filter((f) => !f.ok).length;
  console.log(
    warnings === 0
      ? '\nThe org is ready for Salesforce Multi-Framework.'
      : `\n${warnings} warning(s) - see the hints above.${findings.some((f) => f.production) ? ' This is a production org: stop here.' : ''}`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
