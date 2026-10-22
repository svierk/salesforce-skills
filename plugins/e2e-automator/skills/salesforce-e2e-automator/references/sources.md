# Sources

Where every fact about UTAM testing lives, and how to read it at run time. Read from here instead of relying on what this skill - or your memory - says about versions, configuration or page object APIs.

## The template

`svierk/salesforce-utam-e2e-testing` is the reference setup. It has no releases; read `main` and note the commit you read, so a later comparison has a fixed point:

```bash
gh api repos/svierk/salesforce-utam-e2e-testing/commits/main --jq .sha
gh api -H "Accept: application/vnd.github.raw+json" "repos/svierk/salesforce-utam-e2e-testing/contents/<path>"
```

Without the GitHub CLI: `https://raw.githubusercontent.com/svierk/salesforce-utam-e2e-testing/main/<path>`.

| Need                                                    | Path                                      |
| ------------------------------------------------------- | ----------------------------------------- |
| Dependencies, npm scripts, Node version (`engines`)     | `package.json`                            |
| Compiler configuration                                  | `utam.config.js`                          |
| Runner: browser, headless flags, timeouts, UTAM service | `wdio.conf.js`                            |
| Login URL into `.env`                                   | `scripts/generate-login-url.js`           |
| Login helper used by every spec                         | `force-app/test/utam/utam-helper.js`      |
| Example specs                                           | `force-app/test/utam/*.spec.js`           |
| ESLint block for UTAM specs                             | `eslint.config.js` (section "UTAM tests") |
| CI job with JWT login, compile, run                     | `.github/workflows/ci.yml` (job `tests`)  |
| Conventions for that job                                | `README.md`, "Automated test execution"   |

The comments in `wdio.conf.js` explain settings that look odd but are deliberate - classic WebDriver instead of BiDi, the virtual WebAuthn authenticator for orgs that ask for a passkey. Keep them when you copy the file.

## npm packages

```bash
npm view salesforce-pageobjects dist-tags --json    # one tag per Salesforce release, e.g. "spring26"
npm view salesforce-pageobjects readme | head -20   # compatible wdio-utam-service range for this version
npm view utam version
npm view wdio-utam-service version
npm view @wdio/cli version
```

| Package                  | What it is                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `utam`                   | Compiler (`utam`), generator (`utam-generate`) and linter                                                 |
| `wdio-utam-service`      | Connects UTAM to WebdriverIO; provides the `utam` global in specs                                         |
| `salesforce-pageobjects` | Salesforce's page objects for Lightning Experience and the mobile apps; major version follows the release |
| `@wdio/*`                | WebdriverIO runner, Jasmine framework, reporter                                                           |

`salesforce-pageobjects` is versioned by Salesforce release: a new major per release, with a dist-tag named after it. Its README states which `wdio-utam-service` versions it works with - check that range before upgrading either one.

## The installed page objects

The package in `node_modules/salesforce-pageobjects/dist` is the authoritative API for the project:

- `**/*.utam.json` - the JSON sources: selectors, elements, compose methods, descriptions
- `**/pageObjects/**/*.d.ts` - the compiled API with exact signatures; what the script's `show` prints
- `utam.manifest.json` - maps UTAM types (`utam-records/pageObjects/recordLayoutItem`) to source files
- `ui-global-components.config.json` - the injection config that picks implementations for interfaces; `wdio.conf.js` loads it

Import path: `salesforce-pageobjects/<folder>/pageObjects/<name>` - the script prints it for every hit. Custom page objects use the same string as `type` when they contain a Salesforce component.

## UTAM documentation

`https://developer.salesforce.com/docs/platform/utam` - the guides and the grammar reference. Pages worth reading for a specific question:

| Question                                   | Page                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| Compiler options, JavaScript setup         | `/guide/js-guide.html`                                         |
| Designing page objects                     | `/guide/page-objects.html`                                     |
| Lint rules and the SARIF report            | `/guide/linting.html`                                          |
| Stale elements after a refresh             | `/guide/stale-elements.html`                                   |
| `nullable` versus `isPresent`              | `/guide/nullable-vs-ispresent.html`                            |
| Generator from HTML                        | `/guide/generator-get-started.html`                            |
| Chrome extension                           | `/guide/browser-extension.html`                                |
| JSON grammar: elements, selectors, methods | `/references/utam-grammar/grammar.html` and the pages it links |
| Waits                                      | `/references/utam-grammar/explicit-waits.html`                 |
| Filters (find an element by text or label) | `/references/utam-grammar/element-filters.html`                |
| Compiler error codes                       | `/references/utam-grammar/error-codes.html`                    |

The pages render client-side; if a fetch returns only navigation, use the guide index above and the grammar reference rather than guessing.

## Examples

- `salesforce/utam-js-recipes` - Salesforce's own examples: record create and update, app navigation, custom page objects for a component and an app page, the generator
- `trailheadapps/ebikes-lwc` - a sample app with page objects for its components and a three-region app page, in `force-app/main/default/**/__utam__` and `force-app/test/utam`

Read them for patterns, not for versions - their dependencies lag behind. Some of their choices, such as field access by section and row index in the recipes, are not what to copy either - see [writing-specs.md](writing-specs.md).
