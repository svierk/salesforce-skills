# Sources

Where every fact about HXL lives, and how to read it at run time. HXL is a beta: the component palette, the metadata formats, the channels and the setup change between releases. Read them here instead of relying on what this skill - or your memory - says, and name the release a fact belongs to when you state it.

## Polyglot Arcade

`svierk/polyglot-arcade` is the reference. From v1.1.0 its **headless surface** shows a Hall of Fame and a player card in Claude, served by the custom MCP server `polyglotArcade` on the same `Arcade_Score__c` records as its Angular hub, its React cabinet and its Lightning pages - verified end to end in scratch orgs and in Claude. Read the latest release and note its tag:

```bash
gh release view --repo svierk/polyglot-arcade --json tagName,publishedAt
gh api -H "Accept: application/vnd.github.raw+json" "repos/svierk/polyglot-arcade/contents/<path>?ref=<tag>"
```

Without the GitHub CLI: `https://raw.githubusercontent.com/svierk/polyglot-arcade/<tag>/<path>`. The documentation site serves Markdown for agents: `https://svierk.github.io/polyglot-arcade/llms.txt`, and `<page>.md` for every page.

| Need                                                             | Where                                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The headless surface: tools, widgets, building blocks, limits    | `docs/architecture/headless.md`                                                                                               |
| Why a surface and not an integration pattern; what was verified  | `docs/decisions/0003-headless-surface.md`                                                                                     |
| MCP and widget buttons as a channel, with a sequence             | `docs/architecture/communication.md` (section "MCP and HXL widgets")                                                          |
| Connect Claude; troubleshooting                                  | `docs/deploy/index.md` (section "Connect Claude"), `docs/deploy/troubleshooting.md`                                           |
| Apex tools and their tests                                       | `force-app/main/default/classes/ArcadeHallOfFame.cls`, `ArcadePlayerCard.cls`, `ArcadeScoreStats.cls`, `ArcadeToolsTest.cls`  |
| Widgets                                                          | `force-app/main/default/uiWidgets/arcadeHallOfFameWidget/`, `arcadePlayerCardWidget/`                                         |
| Response and envelope types, renderers                           | `force-app/main/default/lightningTypes/`                                                                                      |
| MCP server definition, External Client App, HXL setting          | `force-app/main/default/mcpServerDefinitions/`, `externalClientApps/`, `extlClntApp*/`, `settings/UiWidget.settings-meta.xml` |
| Setup: HXL before the deploy, activation and printout, preflight | `scripts/org-setup.mjs` (deploy step), `scripts/connect.mjs`, `scripts/preflight.mjs`                                         |
| Release acceptance in CI                                         | `.github/workflows/scratch-org.yml`                                                                                           |

## Salesforce documentation

| Question                                                               | Where                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What HXL is, prerequisites, channels                                   | HXL Developer Guide, `https://developer.salesforce.com/docs/platform/hxl/` - pages `overview`, `guide/get-started.html`, `guide/prerequisites.html`, `guide/hxl-rich-ui.html` |
| Widget files: composition, configuration, schema, `meta` (if, forEach) | `guide/hxl-widget-composition.html`, `guide/hxl-widget-configuration.html`, `guide/hxl-widget-schema.html`                                                                    |
| Components and their properties, HXL Lightning types                   | `references/hxl-reference-about/<component>.html` (`table`, `list`, `button`, ...), `references/hxl-reference-about/hxl-lightning-types.html`                                 |
| Mapping a widget for MCP, with all files                               | `guide/hxl-widget-example-mapping-mcp.html`                                                                                                                                   |
| Apex action, custom MCP server, org setup, connecting clients          | `guide/hxl-mcp-channels.html`, `hxl-mcp-apex.html`, `hxl-mcp-server.html`, `hxl-mcp-setup-org.html`, `hxl-mcp-setup-client.html`                                              |
| Hosted MCP servers: External Client App, scopes, client configuration  | `https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/` - `setup-overview.html`, `create-external-client-app.html`, `claude.html`, `chatgpt.html`          |
| Custom Lightning types: object- and Apex-based, configuration files    | `https://developer.salesforce.com/docs/platform/lightning-types/guide/` - `lightning-types-object.html`, `lightning-types-apex.html`, `lightning-types-core.html`             |
| Interactive playground                                                 | `https://www.headlessexperiencelayer.com`                                                                                                                                     |
| What changed in a release                                              | The release notes and the Salesforce Developers Blog post for the release                                                                                                     |

The guides render most of their content on the server, but code samples sit in attributes of `dx-code-block` elements and some samples are only screenshots. If a fetched page has text but no code, read the raw HTML: `curl -sL <page> | grep -o 'code-block="[^"]*"'`, and unescape the HTML entities. The guides leave out much of what a working setup needs - [verified.md](verified.md) has what was checked in an org.

## The org itself

The org is the most current source for the palette and the shapes:

```bash
# Components the org offers for widgets
sf api request rest '/services/data/v<api>/actions/standard/discoverUiComponents' --method POST \
  --body '{"inputs":[{"pageType":"FRAGMENT"}]}' -o <alias>

# Properties, defaults and enums of chosen components (never tile/widget)
sf api request rest '/services/data/v<api>/actions/standard/getUiComponentSchemas' --method POST \
  --body '{"inputs":[{"pageType":"FRAGMENT","componentDefinitions":["tile/text","tile/row"]}]}' -o <alias>

# The outputs of an Apex action - the source of the response type
sf api request rest '/services/data/v<api>/actions/custom/apex/<Class>' -o <alias>

# Metadata types and settings the org knows
sf org list metadata-types -o <alias> --json
sf org list metadata --metadata-type Settings -o <alias> --json
```

## Salesforce's own skills

[`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills) - installable with `npx skills add forcedotcom/sf-skills` - publishes generator skills for single pieces of the chain. Read their `SKILL.md` and references for the authoring details of the day; they are precise on shapes and naming:

| Skill                                       | Generates                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `platform-mcp-tool-widget-coordinate`       | Response and envelope type plus widget for an Apex-backed MCP tool, with validation gates      |
| `platform-widget-generate`                  | A widget bundle; its references cover formulas, `meta` directives, actions, labels and styling |
| `platform-custom-lightning-type-generate`   | A custom Lightning type, including the widget rendition                                        |
| `platform-lightning-type-widget-coordinate` | An Apex-backed type and widget for an Agentforce agent action (the Lightning channel)          |

They do not cover turning HXL on, sign-in, activating the server, permission sets, connecting a client or testing the chain - that is this skill.

## Salesforce CLI

Read commands and flags from `sf <command> --help`; useful ones here: `sf api request rest`, `sf data query --use-tooling-api`, `sf data create record --use-tooling-api`, `sf project retrieve start --target-metadata-dir`, `sf org open --url-only`, `sf apex run test`.
