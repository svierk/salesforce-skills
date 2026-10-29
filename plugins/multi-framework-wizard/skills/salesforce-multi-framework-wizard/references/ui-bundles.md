# UI bundles

How a React or Angular app becomes a Salesforce app: scaffolded from a template, launched from the App Launcher, connected to the org's data, and tested without an org. Polyglot Arcade's two bundles - `pixelCabinet` (React) and `polyglotArcade` (Angular) - show every piece; the paths are in [sources.md](sources.md#polyglot-arcade).

## Scaffold

- **Start from Salesforce's templates.** `sf template generate project --template <template>` for a new project, `sf template generate ui-bundle` to add a bundle to an existing one - list the templates and flags with `--help`. Polyglot Arcade started from `angularinternalapp` and `reactbasic`; Winter '27 added `angularexternalapp` and `angularbasic`.
- **Keep what the template wires up** - the build plugins, the dev-server proxy, the GraphQL codegen, ESLint and Playwright configuration, the data client. They carry the platform's integration; replacing them with a hand-rolled setup loses the API version injection, the dev proxy and the schema checks.
- **Keep the licenses.** Template files are under Salesforce's BSD 3-Clause license and some carry its copyright header. Keep the headers and list what was derived, as the arcade's `THIRD_PARTY_NOTICES.md` does.
- **A bundle is its own npm project** in `force-app/main/default/uiBundles/<name>/`, with its own `package.json`, lockfile and `engines`. The Salesforce DX project around it holds the LWCs, the metadata and the setup scripts. Nothing is imported across bundles.
- **What the template leaves to you.** `sf template generate ui-bundle --template reactbasic` (12.4.x) writes the bundle, but no Custom Application, no permission set and no `<target>` in `.uibundle-meta.xml`. A bundle without `target` still launches from the App Launcher (verified on API 68.0); set `<target>CustomApplication</target>` anyway, as Polyglot Arcade does, so the intent is explicit. Then add the app and the permission set ([Anatomy](#anatomy)).
- **Make the project around it ignore the bundle.** The Salesforce CLI reads only the root `.forceignore` - add `**/uiBundles/*/node_modules/**` there, or a deploy of the whole package directory uploads every dependency and fails (X-ray `forceignore-node-modules`). The project's own Prettier, Jest (`modulePathIgnorePatterns`) and Code Analyzer (`ignores.files` in `code-analyzer.yml`, otherwise it checks `dist/` against SLDS rules) leave `uiBundles/` to the bundle's own tooling. Git-ignore `dist/`, `build/`, `tsconfig*.tsbuildinfo` and the root `schema.graphql`.

## Anatomy

| File                                               | Purpose                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<name>.uibundle-meta.xml`                         | The `UIBundle` metadata: `masterLabel`, `description`, `isActive`, `version`, `target` (`CustomApplication` for an App Launcher app)                                             |
| `ui-bundle.json`                                   | Where the build lands (`outputDir`) and how routes resolve (`routing`: `trailingSlash`, `fallback: index.html` so deep links of a single-page app work)                          |
| `applications/<name>.app-meta.xml`                 | The App Launcher entry: a `CustomApplication` with `<uiBundle><namespace>__<name></uiBundle>`, its label, brand color and form factors                                           |
| A permission set                                   | `applicationVisibilities` with `visible` true for the app, plus object and field permissions for everything the bundle reads and writes                                          |
| `index.html`                                       | The page shell. `<meta name="sf-session-banner" content="disabled">` only when the app shows the user and a logout itself                                                        |
| `.forceignore` in the bundle                       | Keeps `node_modules` and test files out of the deployment                                                                                                                        |
| React: `vite.config.ts`                            | `@salesforce/vite-plugin-ui-bundle` next to the React plugin, `base: './'`, codegen only when the schema exists                                                                  |
| Angular: `angular.json`, `esbuild/`, `middleware/` | The custom esbuild builder with the API version and codegen plugins of `@salesforce/angular-plugin-ui-bundle`, `deployUrl: './'`, and the dev server's HTML and proxy middleware |
| `codegen.yml`, `.graphqlrc.yml`                    | Point at the org's `schema.graphql` at the project root and generate the operation types                                                                                         |

## Runtime environment

- **`SFDC_ENV`** is set on the page in the org: `basePath` (for example `/app/c__pixelCabinet`), `appName`, `orgUrl`. React passes `basePath` without a trailing slash as the router's `basename`; the Angular template handles its base path itself. Outside an org - dev server, unit and e2e tests - `SFDC_ENV` is undefined: every helper that reads it returns `null` and the UI hides what needs it.
- **`__SF_API_VERSION__`** is injected at build time by the plugins. Never write an API version into a URL in the bundle.
- **Assets are relative** (`base: './'`, `deployUrl: './'`), because the bundle is served under its base path.
- **Fonts and libraries come from npm and are bundled.** A CDN needs a trusted site per host and breaks without network access to it.

## Data

- **One client.** Wrap `createDataSDK()` in one module or service - the arcade's `graphqlClient.ts` (React) and `DataClient` (Angular). It routes mutations to `graphql.mutate` and everything else to `graphql.query` - the SDK rejects an operation sent to the wrong method - and turns `errors` and a null `data` into one kind of exception.
- **A domain API on top** - `arcadeApi.ts`, `ArcadeApi` - with named operations prefixed per surface (`CabinetCreateScore`, `HubGames`), so logs, codegen and debugging show which surface sent what.
- **Cache by how the data changes.** Reads of data that changes on other surfaces or for other users skip the SDK's query cache (`cacheControl: 'no-cache'`); configuration that changes with a deployment can be cached.
- **Types from the org's schema.** `npm run graphql:schema` downloads the schema by introspection, `npm run graphql:codegen` generates the operation types, and the GraphQL ESLint plugin checks every operation against it. The schema is per org and not committed; the build skips codegen when it is missing, so CI builds without an org - commit the generated operation types for that. `npm run build` type-checks (`tsc -b`) before Vite's codegen plugin runs: after changing an operation, run `npm run graphql:codegen` first. A new custom field is missing from the schema until the user can read it - the permission set comes before the schema download.
- **Field-level security shows up as missing data.** A field the user cannot read is null or fails the query: grant exactly what the bundle needs in its permission set, and handle the absence.
- **REST through `sdk.fetch`** only for what GraphQL cannot do - an Apex REST endpoint is then a public endpoint with every rule that comes with it ([data-and-security.md](data-and-security.md)).
- **SDK extensions, labels and i18n** (`defineDataExtension`, the labels extension, `@salesforce/platform-sdk/i18n`) arrived in Winter '27 - read the current API in the package before using them.

## Structure that survives three frameworks

- **Logic outside the framework.** Rules, calculations and state machines in framework-free TypeScript - the arcade's `engine.ts` per game - with their own unit tests. Components render and handle input. The logic moves between frameworks unchanged, and the tests do not need a DOM.
- **A registry keyed by the record's key.** Each bundle lists what it offers under the same key the configuration record carries (`Game_Key__c`); the record, the registry, the artwork and the host's property list tie together by that key.
- **Shared look by copy, own identity by surface.** The arcade keeps one shared stylesheet (`arcade.css`: tokens, header bar, shared markup) identical in both bundles - changed together, called out in the contributing guide - and a `surface.css` per bundle for its own color and room. Larger shared code earns an npm package; small shared CSS does not.
- **A stage around the feature.** The component that saves results, announces them and talks to a host is generic (`GameStage`); the feature only reports what happened. Embedding and saving live in one place per bundle.

## Dev loop

- `npm run dev` in the bundle folder starts Vite or the Angular dev server; data calls are proxied to the **default org** of the Salesforce CLI. If the default org is not the one to use, say so and ask before `sf config set target-org` - it changes the user's default for every project command.
- `SF_TARGET_ORG=<alias> npm run graphql:schema` fetches the schema from a named org without touching the default.
- To see the bundle framed in Lightning while iterating, point the host at the dev server ([embedding.md](embedding.md#local-development)).
- Agentforce Vibes' Live Preview is an alternative for teams on it.

## Build and deploy

- **Build before deploy.** A bundle is deployed with its build output (`outputDir`, usually `dist/`). Every bundle needs `npm ci` and `npm run build` before `sf project deploy start` - locally, in the setup script and in every pipeline.
- **One bundle alone:** `sf project deploy start --source-dir force-app/main/default/uiBundles/<name> --target-org <alias>` after its build.
- **Hashed build files and source tracking.** After a rebuild, a scratch org's source tracking can remember the previous hashed files as deleted and fail with `Expected source files for type 'UIBundle'`. Deploy the source directory once with `--source-dir`, then continue - [review.md](review.md#diagnosing).
- **Packaging** of internal apps goes through second-generation packages since Winter '27; external, site-based apps could not be packaged at that release, and Developer Edition orgs only have the `c` namespace. Check the release before promising either.

## Tests without an org

| Scope | Runner                                                      | Covers                                                                                                                    |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Logic | Vitest (React), `ng test` with the Vitest builder (Angular) | Engines, helpers that read `SFDC_ENV`, the data client with `createDataSDK` mocked                                        |
| UI    | Playwright against the static build                         | Pages and flows end to end; data calls fail gracefully or are answered by mocks; axe against WCAG 2.1 AA; touch at 375 px |
| LWC   | `sfdx-lwc-jest` with `@sa11y/jest`                          | Host and native components, with a stub for `lightning-ui-embedding` ([embedding.md](embedding.md#the-host-lwc))          |

- The arcade's `build:e2e` script rewrites asset paths to root-relative ones and adds a single-page fallback, so `serve` can host the build for Playwright.
- The SFDX project's Jest ignores `uiBundles/` - each bundle brings its own runner. Vitest tests import `describe`, `it` and `expect` from `vitest`; with the template's ESLint config, globals are reported as `no-undef`.
- CI installs with `npm ci --ignore-scripts`, which skips the template's `postinstall` - run `npx patch-package` right after it.
- CI runs one job per bundle with that bundle as working directory and its own Node version, plus one job for the SFDX project. A separate workflow on release tags creates a scratch org, runs the setup twice and checks that data survived ([org-and-deploy.md](org-and-deploy.md#release-acceptance)).
