# Sources

Where every fact about building Lightning web components lives, and how to read it at run time. Read from here instead of relying on what this skill - or your memory - says about versions, configuration, base components or the collection.

## The collection

`svierk/awesome-lwc-collection` is the reference: components with tests and documentation, and the project setup around them. It has no releases; read `main` and note the commit, so a later comparison has a fixed point:

```bash
gh api repos/svierk/awesome-lwc-collection/commits/main --jq .sha
gh api -H "Accept: application/vnd.github.raw+json" "repos/svierk/awesome-lwc-collection/contents/<path>"
gh api "repos/svierk/awesome-lwc-collection/contents/force-app/main/default/lwc/<component>" --jq '.[].path'
```

Without the GitHub CLI: `https://raw.githubusercontent.com/svierk/awesome-lwc-collection/main/<path>`.

| Need                                                              | Path                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Dependencies, npm scripts, Node version, pre-commit file patterns | `package.json` (`devDependencies`, `scripts`, `engines`, `lint-staged`) |
| ESLint for components, tests and mocks                            | `eslint.config.js`                                                      |
| Jest configuration and the mocks it maps                          | `jest.config.js`, `force-app/test/jest-mocks/lightning/`                |
| Accessibility matcher and polyfills for every test                | `jest-setup.js`                                                         |
| Prettier with the LWC template parser                             | `.prettierrc`, `.prettierignore`                                        |
| Pre-commit hook                                                   | `.husky/pre-commit`                                                     |
| What never goes to the org                                        | `.forceignore`                                                          |
| Salesforce Code Analyzer configuration                            | `code-analyzer.yml`                                                     |
| README check against the component source                         | `scripts/check-readmes.mjs`                                             |
| What a new component must ship                                    | `CONTRIBUTING.md`, "Adding a new component"                             |
| CI job: Prettier, ESLint, README check, Code Analyzer, tests      | `.github/workflows/ci.yml`                                              |
| A component                                                       | `force-app/main/default/lwc/<component>/`, Apex in `.../classes/`       |

## The catalog

The collection's documentation site is built for agents: an index of every component with a one-line description, and a Markdown page per component with attributes, events, usage and dependencies.

```bash
curl -s https://svierk.github.io/awesome-lwc-collection/llms.txt                       # index, grouped by category
curl -s https://svierk.github.io/awesome-lwc-collection/components/<component>.md      # one component
curl -s https://svierk.github.io/awesome-lwc-collection/llms-full.txt                  # every page in one file
```

Search the index for the need ("table", "file", "map", "signature", "combobox") before building, and for "GraphQL" when a component would otherwise need Apex to read or write records. A component page lists what it depends on - other components (`c/...`), Apex classes (`@salesforce/apex/...`), static resources (`@salesforce/resourceUrl/...`), field sets - and all of it has to come along when you copy it.

To copy a component, read every file of its folder, its `__tests__` with the data files, and each dependency. For several files, a shallow clone into the session's scratchpad directory is faster than one request per file:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/svierk/awesome-lwc-collection.git <scratch dir>/awesome-lwc-collection
git -C <scratch dir>/awesome-lwc-collection sparse-checkout set force-app/main/default/lwc/<component> force-app/main/default/classes
```

The collection is maintained, but older components can predate a recommendation. Run the checker on what you copy and fix what it finds in the copy.

## Salesforce recipes

`trailheadapps/lwc-recipes` - Salesforce's examples, one small component per concept: wire adapters, GraphQL, Apex, Lightning Message Service, navigation, events, modals, third-party libraries, and the Jest tests for each. Read them for patterns. Its `force-app/test/jest-mocks` are where most of the collection's mocks come from.

## Documentation

| Question                                                    | Where                                                                                                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How LWC works: templates, lifecycle, events, data, security | LWC Developer Guide, `https://developer.salesforce.com/docs/platform/lwc/guide`                                                                                                   |
| Attributes, methods, events and slots of a base component   | Component Reference, `https://developer.salesforce.com/docs/component-library/overview/components`                                                                                |
| Which data source: LDS, GraphQL, Apex                       | LWC Developer Guide, "Data Guidelines" (`/guide/data-guidelines.html`)                                                                                                            |
| GraphQL queries, aggregates and what the release supports   | GraphQL API Developer Guide, "GraphQL Wire Adapter for LWC", `https://developer.salesforce.com/docs/platform/graphql/guide/graphql-wire-lwc.html`                                 |
| GraphQL mutations from a component                          | LWC Developer Guide, `executeMutation` reference (`/guide/reference-graphql-mutation.html`); limits in the GraphQL API Developer Guide, "Mutations Limitations"                   |
| Why and how to move a component from Apex to GraphQL        | "Replace Apex with GraphQL in Your Salesforce UI Architecture" (Medium), linked from the catalog pages of `graphqlDatatable` and `graphqlMapView`                                 |
| What Lightning Web Security changes in an API               | Lightning Web Security guide and its Distortion Viewer, `https://developer.salesforce.com/docs/platform/lightning-components-security/guide`                                      |
| Styling hooks, SLDS 2, utility classes, blueprints          | `https://www.lightningdesignsystem.com` and LWC Developer Guide, "Style Components"                                                                                               |
| Styling that is not supported                               | LWC Developer Guide, "Anti-Patterns for Styling Components" (`/guide/create-components-css-antipatterns.html`)                                                                    |
| Targets and their configuration in `js-meta.xml`            | LWC Developer Guide, "XML Configuration File Elements"                                                                                                                            |
| Sharing state between components                            | LWC Developer Guide, "State Managers" (`/guide/state-management.html`) - check availability for the org's release                                                                 |
| Anti-patterns, with the reasons                             | Salesforce Developers Blog, "Security Anti-Patterns in Lightning Web Components" (June 2026) and "Data and Communication Anti-Patterns in Lightning Web Components" (August 2026) |

The developer guide renders client-side. If a fetch returns only navigation, search the web for the page title and read the result, rather than guessing.

## npm packages

```bash
npm view @salesforce/sfdx-lwc-jest version
npm view @salesforce/eslint-config-lwc version peerDependencies --json
npm view @sa11y/jest version
npm view @salesforce-ux/slds-linter version
```

| Package                               | What it is                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@salesforce/sfdx-lwc-jest`           | Jest preset for LWC: compiler, stubs for base components, test wire adapters                     |
| `@salesforce/wire-service-jest-util`  | Test wire adapters for your own mocks (`createLdsTestWireAdapter`, `createTestWireAdapter`)      |
| `@salesforce/eslint-config-lwc`       | ESLint configurations for LWC - `recommended`, `i18n` and more; its peer dependencies come along |
| `@lwc/eslint-plugin-lwc`              | The LWC rules behind it, such as `no-api-reassignments`, `no-document-query`, `no-inner-html`    |
| `@salesforce/eslint-plugin-lightning` | Salesforce platform rules that the configurations above use                                      |
| `@sa11y/jest`                         | `toBeAccessible()` - automated accessibility checks in Jest                                      |
| `@salesforce-ux/slds-linter`          | SLDS 2 readiness for CSS and templates, with `--fix` and a SARIF report                          |

## Salesforce CLI

Check `--help` before you rely on a flag - commands move between plugins and releases.

```bash
sf template generate lightning component --type lwc --name <name> --output-dir <lwc folder>
sf lightning dev component --name <name> --target-org <alias>          # Local Dev: one component, hot reload
sf lightning dev app --target-org <alias>                              # Local Dev: a Lightning app
sf project deploy start --source-dir <bundle> --target-org <alias>
sf code-analyzer run --workspace force-app --view table                # ESLint, PMD, regex, RetireJS and more - Apex security included
npx @salesforce-ux/slds-linter lint <folder>                           # SLDS 2 readiness, add --fix to fix what it can
```

Local Dev needs the `@salesforce/plugin-lightning-dev` plugin and an org where it is enabled. The old LWC Local Development Server (`sf force lightning lwc start`) is retired - replace npm scripts that still call it.
