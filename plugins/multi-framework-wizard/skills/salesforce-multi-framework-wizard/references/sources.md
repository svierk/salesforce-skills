# Sources

Where every fact about Salesforce Multi-Framework lives, and how to read it at run time. Multi-Framework moves with every release - what is generally available, in beta or not supported yet, which framework a feature accepts, the exports of the SDK, the templates and the org requirements. Read them here instead of relying on what this skill - or your memory - says, and name the release a fact belongs to when you state it.

## Polyglot Arcade

`svierk/polyglot-arcade` is the reference: an Angular UI bundle (the hub), a React UI bundle (the cabinet), a Lightning app with a host LWC and a native leaderboard, and an LWC OSS game hosted on Vercel - one org's data, four integration patterns, decision records with what was verified in a real org. It has releases; read the latest and note its tag, so a later comparison has a fixed point:

```bash
gh release view --repo svierk/polyglot-arcade --json tagName,publishedAt
gh api -H "Accept: application/vnd.github.raw+json" "repos/svierk/polyglot-arcade/contents/<path>?ref=<tag>"
gh api "repos/svierk/polyglot-arcade/contents/<folder>?ref=<tag>" --jq '.[].path'
```

Without the GitHub CLI: `https://raw.githubusercontent.com/svierk/polyglot-arcade/<tag>/<path>`. For many files, a shallow clone into the session's scratchpad directory is faster:

```bash
git clone --depth 1 --branch <tag> https://github.com/svierk/polyglot-arcade.git <scratch dir>/polyglot-arcade
```

The documentation site is built for agents - an index with a line per page, and a Markdown copy of every page:

```bash
curl -s https://svierk.github.io/polyglot-arcade/llms.txt                         # index
curl -s https://svierk.github.io/polyglot-arcade/architecture/patterns.md         # one page
curl -s https://svierk.github.io/polyglot-arcade/llms-full.txt                    # every page in one file
```

| Need                                                                   | Where                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Multi-Framework in a nutshell, which framework is used where and why   | `docs/concepts.md`                                                                                               |
| Surfaces, roles, navigation between them, the platform facts behind it | `docs/architecture/index.md`, `docs/decisions/0001-surface-roles.md`                                             |
| The four integration patterns and the record fields that select one    | `docs/architecture/patterns.md`, `force-app/main/default/uiBundles/polyglotArcade/src/app/xray.ts`               |
| Channels, sequences of an embedded round, the package-free bridge      | `docs/architecture/communication.md`                                                                             |
| Data model, configuration record, permission set, reports              | `docs/architecture/data-model.md`, `force-app/main/default/objects/`, `.../permissionsets/`                      |
| Decision record format and the decisions taken                         | `docs/decisions/`                                                                                                |
| Host LWC: frame, props, events, host saves, errors                     | `force-app/main/default/lwc/arcadeGameHost/` with its `__tests__`                                                |
| Page fan-out with Lightning Message Service                            | `force-app/main/default/lwc/arcadeLeaderboard/`, `.../messageChannels/`                                          |
| React guest: View SDK props and events, chromeless embed route         | `uiBundles/pixelCabinet/src/embedding/hostBridge.ts`, `src/cabinet/EmbedLayout.tsx`, `src/cabinet/GameStage.tsx` |
| Data client and domain API, React and Angular                          | `uiBundles/pixelCabinet/src/api/`, `uiBundles/polyglotArcade/src/app/api/`                                       |
| Links between bundles and into Lightning                               | `uiBundles/pixelCabinet/src/cabinet/hub.ts`, `uiBundles/polyglotArcade/src/app/arcade-floor.ts`                  |
| Bundle build: Vite plugin, Angular esbuild plugins and dev middleware  | `uiBundles/pixelCabinet/vite.config.ts`; `uiBundles/polyglotArcade/angular.json`, `esbuild/`, `middleware/`      |
| Bundle metadata and its App Launcher app                               | `uiBundles/*/*.uibundle-meta.xml`, `uiBundles/*/ui-bundle.json`, `force-app/main/default/applications/`          |
| GraphQL schema, codegen and operation linting                          | `uiBundles/*/codegen.yml`, `.graphqlrc.yml`, `scripts/get-graphql-schema.mjs`, `eslint.config.js`                |
| Trusted sites for production and for local development only            | `force-app/main/default/cspTrustedSites/`, `dev/main/default/cspTrustedSites/`                                   |
| Jest stub for `lightning-ui-embedding`                                 | `jest-mocks/lightning/uiEmbedding/`, `jest.config.js`                                                            |
| Org preflight, one-command setup, connect step                         | `scripts/preflight.mjs`, `scripts/org-setup.mjs`, `scripts/org-setup.config.json`, `scripts/connect.mjs`         |
| Scratch org definition                                                 | `config/project-scratch-def.json`                                                                                |
| CI without an org; release acceptance in a scratch org                 | `.github/workflows/ci.yml`; `.github/workflows/scratch-org.yml`                                                  |
| Adding a feature to each home - hub, cabinet, external guest           | `docs/build-your-own-game.md`                                                                                    |
| Dev servers, embedding a local app, tests and checks                   | `docs/development.md`                                                                                            |
| Symptoms and fixes; upgrades and leftovers                             | `docs/deploy/troubleshooting.md`; `docs/deploy/upgrade.md`                                                       |
| What the project took from Salesforce's templates                      | `THIRD_PARTY_NOTICES.md`                                                                                         |

Polyglot Arcade is a demo: games, a lobby, scores. Translate its roles into the user's domain - the hub is the app users start from, the cabinet is a specialised app, the score is whatever record a guest produces - rather than copying the theme.

## The external guest

`svierk/lwc-oss-snake-game` is the guest without a Salesforce session: an LWC OSS app on LWR, hosted on Vercel. `src/modules/snake/embedding/embedding.js` implements the guest side of the package-free bridge in plain JavaScript, with tests in its `__tests__` folder; the README's "Embedding in Salesforce" section has the sequence, the event and the trust settings. Both are MIT-licensed - copy them as a starting point and keep the notice.

## Salesforce documentation

| Question                                                                              | Where                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What Multi-Framework is, React and LWC compared, org setup, Data SDK, styling         | Multi-Framework guide, `https://developer.salesforce.com/docs/platform/multiframework/guide/` - pages `multiframework-overview`, `reactdev-lwc-diff`, `reactdev-setup`, `reactdev-integrate`, `reactdev-styling`, `reactdev-data-sdk-usage`  |
| Embedding: get started, exchange data, style, resize, unsaved changes, screen readers | UI Embedding guide, `https://developer.salesforce.com/docs/platform/microfrontend/guide/` - pages `get-started`, `exchange-data`, `style-embedded-app`, `resize-embedded-app`, `track-unsaved-changes`, `accessible-embedded-app`, `recipes` |
| Embedding an internally hosted UI bundle: status, frameworks, settings                | UI Embedding guide, `internal-ui-bundles.html`                                                                                                                                                                                               |
| The package-free bridge and its security checks                                       | UI Embedding guide, `package-free-bridge.html`; the `sf-embedding` protocol specification it links is authoritative                                                                                                                          |
| Error codes of a frame                                                                | `https://developer.salesforce.com/docs/platform/microfrontend/references/microfrontend-error-codes/error-codes.html`                                                                                                                         |
| What changed in a release, and its status                                             | Release notes (Winter '27: `release-notes.rn_headless360_mfw.htm`), the Salesforce Developers Blog posts "What's New in Salesforce Multi-Framework" and "The Salesforce Developer's Guide to the <release> Release"                          |
| The Agentforce Conversation Client in a UI bundle                                     | Multi-Framework guide, `reactdev-acc.html`, and the Agentforce Conversation Client Developer Guide it links                                                                                                                                  |
| Lightning types, UI widgets, the Headless Experience Layer, agents as MCP tools       | The release's Developer's Guide post, the Lightning Types and Salesforce Hosted MCP Servers guides                                                                                                                                           |
| Agents: Agent Script, metadata, testing                                               | Agentforce Developer Guide; `github.com/salesforce/agentscript`                                                                                                                                                                              |

The developer guides render client-side. If a fetch returns only navigation, search the web for the page title and read the result, rather than guessing.

Sources disagree while a feature moves. In Winter '27 the release blog called microfrontends generally available, while the guide page for internally hosted UI bundles still said beta and React only. The more specific page wins; tell the user what each source says, and verify in the org when the decision depends on it.

## Recipes

`trailheadapps/multiframework-recipes` - Salesforce's examples: `force-app/main/react-recipes`, `force-app/main/angular-recipes` and the micro-frontend recipes in its README. Read them for the current way to do a single thing - a query, a mutation, a frame - before writing it.

## Salesforce's own skills

`forcedotcom/afv-library` (also installable with `npx skills add forcedotcom/sf-skills`, and in Claude Code through `salesforce-development@claude-plugins-official`) publishes `experience-react` - generators for React UI bundles: project, features, data access, deployment, packaging, the Conversation Client, localization, MFA - plus `agentforce-adlc` for agents and `platform-lightning-widgets` for Lightning types and widgets. Read their `SKILL.md` for the generator steps of the day instead of copying them.

## npm packages

Read versions and exports from the registry and from the bundle's installed packages, never from memory:

```bash
npm view @salesforce/platform-sdk version exports --json
npm view @salesforce/vite-plugin-ui-bundle version
npm view @salesforce/angular-plugin-ui-bundle version
npm view @salesforce/agentforce-conversation-client version
node -e "import('@salesforce/platform-sdk').then((m) => console.log(Object.keys(m)))"   # in the bundle folder
```

| Package                                      | What it is                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@salesforce/platform-sdk`                   | The app side of the platform: the Data SDK (`createDataSDK`, GraphQL, `fetch`), the View SDK for embedded apps, the embedding bootstrap, i18n |
| `@salesforce/ui-bundle`                      | Node helpers for scripts, such as `getOrgInfo` for the schema download                                                                        |
| `@salesforce/vite-plugin-ui-bundle`          | Vite plugin for React bundles: dev proxy to the org, build-time API version                                                                   |
| `@salesforce/angular-plugin-ui-bundle`       | Angular builder plugins and dev-server middleware: API version, GraphQL codegen, HTML and proxy middleware                                    |
| `@salesforce/agentforce-conversation-client` | The Agentforce Conversation Client for apps outside Lightning                                                                                 |
| `@salesforce/templates`                      | The project and bundle templates behind `sf template generate`                                                                                |

## Salesforce CLI

Check `--help` before you rely on a command, flag or template name - they move between plugins and releases.

```bash
sf template generate project --help                                   # project templates, React and Angular among them
sf template generate ui-bundle --help                                 # add a bundle to an existing project
sf org list metadata-types --target-org <alias> --json                # does the org know UIBundle?
sf project deploy start --source-dir <bundle folder> --target-org <alias>
sf data query -q "SELECT Name, StartUrl FROM AppMenuItem WHERE Name = '<app>'" --target-org <alias> --json
```
