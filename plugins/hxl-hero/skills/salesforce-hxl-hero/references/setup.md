# Setup

How an org gets from nothing to a connected client - once by hand, and as a setup the whole team runs with one command. Polyglot Arcade's `npm run setup` is the reference ([sources.md](sources.md#polyglot-arcade)).

## Requirements

- An org on a release with HXL and Salesforce Hosted MCP servers (API 67.0 and later at Winter '27) - a scratch org, a sandbox or a Developer Edition. Production gets HXL through the team's pipeline.
- The Salesforce CLI, and for trying the chain without a client: Node.js, `playwright-core` and Google Chrome in a workspace ([testing.md](testing.md#workspace)).

The preflight of this skill checks the org read-only:

```bash
node <skill dir>/scripts/preflight.mjs --target-org <alias> [--json]
```

| Check       | Reads                                                    | A gap means                                                        |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Org type    | `Organization` (`IsSandbox`, `OrganizationType`, trial)  | Production: stop - deploy through the pipeline                     |
| API version | the org's API version                                    | Older than 67.0: no HXL                                            |
| HXL setting | `Settings` list, then `Settings:UiWidget` (`hxlEnabled`) | Missing: the release has no HXL. Off: turn it on before the deploy |
| Widgets     | metadata type `UiWidgetBundle`                           | Listed only when HXL is on                                         |
| MCP servers | metadata type `McpServerDefinition`                      | Missing: no hosted MCP servers in this org                         |
| Sign-in     | metadata type `ExternalClientApplication`                | Missing: no External Client Apps                                   |

## Turn HXL on

In a scratch org definition:

```json
{ "settings": { "uiWidgetSettings": { "hxlEnabled": true } } }
```

In any other org, deploy the setting **on its own, before** the deploy with the widgets - in the same deploy it is applied too late:

```xml
<!-- force-app/main/default/settings/UiWidget.settings-meta.xml -->
<UiWidgetSettings xmlns="http://soap.sforce.com/2006/04/metadata">
    <hxlEnabled>true</hxlEnabled>
</UiWidgetSettings>
```

```bash
sf project deploy start --metadata Settings:UiWidget --target-org <alias>
```

Turning it on accepts the beta terms for the org - **Setup → Headless Experience Layer Settings** shows them. Show this before doing it (ground rule 7), and say it in the project's deploy docs.

## Deploy order

1. `Settings:UiWidget` on its own (other orgs) - or the scratch org definition.
2. Everything else in one deploy: Apex, widgets, Lightning types, the server definition, the External Client App, the permission set. The Metadata API orders widgets before the types that reference them.
3. Assign the permission set; activate the server; read the client ID.

## A setup that is safe to run again

Fold the steps into the project's setup script, so the team gets the chain with one command and a second run changes nothing:

| Step       | What it does for HXL                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Preflight  | Warns when the HXL setting or MCP server definitions are missing                                                         |
| Deploy     | Deploys `Settings:UiWidget` first, then the project                                                                      |
| Permission | Assigns the permission set that grants the tool classes                                                                  |
| Connect    | Creates or activates `McpServerAccess`; prints the server URL (sandbox variant from `IsSandbox`) and the OAuth client ID |

- **Idempotent:** creating `McpServerAccess` only when none exists; a redeploy of the External Client App keeps its consumer key.
- **Retrieves outside the project:** read the consumer key with `--target-metadata-dir` into a temporary folder and run the command from there, so source tracking stays untouched.
- **Printed at the end:** the URL, the client ID, where to paste them, one example question - and that a new External Client App can take up to 30 minutes.
- `mcp-connect.mjs` of this skill does the connect part and can be called from the setup or copied into it.

## CI

- **Static checks without an org:** the checker of this skill, formatting, linting.
- **In a scratch org:** the setup, the Apex tests (the DevOps Starter Kit's `sfdx-run-tests` where the project uses the kit), one call of each tool through the Actions REST API with an expected value, and the check that `McpServerAccess` is active:

  ```bash
  sf api request rest --method POST '/services/data/v<api>/actions/custom/apex/<Class>' --body '{"inputs":[{...}]}' -o <alias> | jq -r '.[0].outputValues.<field>'
  sf data query --use-tooling-api --json -q "SELECT COUNT() FROM McpServerAccess WHERE Active = true" -o <alias> | jq -r '.result.totalSize'
  ```

- Sign-in and the client are not part of CI: they need a person and a browser. `mcp-try.mjs` covers them before a release.
- With the DevOps Builder installed, it owns the pipeline - name the settings deploy and the Apex tests when handing over.

## Upgrading an existing project

Coming from a version without HXL, the setup turns the beta on and adds an External Client App - both org-wide. Say so in the project's upgrade notes, with where the beta terms are.
