# Set up

Bring the collection's quality setup for Lightning web components into a Salesforce DX project. Read each file from the collection ([sources.md](sources.md)) at the moment you need it; this page says what to take and what to adjust, not what the files contain.

## New project or existing one

- **New project** - `sf project generate --name <name>` creates a project with ESLint, Jest and Prettier already set up for LWC; compare it with the collection afterwards, item by item.
- **Existing project** - the usual case. Bring in what is missing, on a work branch named the team's way, and leave what the team configured on purpose. A rule the team turned off is a decision; ask before turning it back on.

## Checklist

Compare each item with the project before writing, and show the user the list of changes first.

1. **Node version.** The collection's `engines.node` is what its tooling is tested with. If the project pins an older Node, say so - upgrading Node is the team's decision.
2. **Dependencies.** In their current versions from npm: `@salesforce/sfdx-lwc-jest`, `@salesforce/eslint-config-lwc` with the peer dependencies it names, `@sa11y/jest`, `prettier` with `@prettier/plugin-xml` (and `prettier-plugin-apex` if the project formats Apex), `husky` and `lint-staged`. As needed: `jest-canvas-mock` for components that draw on a canvas, `@ungap/structured-clone` when components use `structuredClone` (Jest's environment may lack it), `eslint-plugin-compat`, `jest-junit` for test reports in CI.
3. **npm scripts.** `lint`, `test:unit` with `:watch`, `:debug` and `:coverage`, `prettier` and `prettier:verify`, `precommit`, `prepare` - as in the collection. Keep names the project already has; pipelines and this skill call them. Replace a script that starts the retired Local Development Server (`sf force lightning lwc start`) with Local Dev ([sources.md](sources.md#salesforce-cli)).
4. **ESLint.** The collection uses the flat configuration (`eslint.config.js`) with three blocks: components (`recommended` plus `i18n`, with stricter rules - `no-console`, `@lwc/lwc/no-document-query`, size limits per file and function), tests (Node globals, a few rules relaxed) and the Jest mocks. Take them and adjust the paths to the project's package directories. A project on the old `.eslintrc` format: moving to the flat configuration is its own change - offer it, do not mix it into a feature.
5. **Jest.** `jest.config.js` extends the preset of `@salesforce/sfdx-lwc-jest`, adds `jest-setup.js` (it registers the `toBeAccessible` matcher and polyfills `structuredClone`) and maps `lightning/*` modules to mocks in `force-app/test/jest-mocks/lightning/`. Bring only the mocks for modules the project's components import; the preset's own stubs cover the rest. Keep `modulePathIgnorePatterns` for `.localdevserver`.
6. **Prettier.** The override that formats `**/lwc/**/*.html` with the `lwc` parser is essential - the default HTML parser puts quotes around `{expression}` attributes, and the LWC compiler rejects quoted expressions. Take `.prettierignore` too (static resources, generated output).
7. **Pre-commit checks.** `husky` runs `npm run precommit`, which runs `lint-staged`: Prettier on every staged file, ESLint and the related Jest tests on staged component files - read the patterns from the collection's `package.json`. Add the checker of this skill for staged `lwc` files if the team wants it in the hook as well:

   ```json
   "**/lwc/**/*.{css,html,js}": ["eslint", "sfdx-lwc-jest -- --passWithNoTests", "node <path to>/lwc-check.mjs --errors-only"]
   ```

   Only with a path every team member has - a copy of the script in the repository, under `scripts/`, not the plugin folder of one machine.

8. **`.forceignore`.** `**/__tests__/**`, `**/jsconfig.json`, `**/.eslintrc.json`, `**/tsconfig.json` - test and editor files do not belong in the org. The collection also ignores `**/*.ts`; leave that line out if the project writes components in TypeScript. If the project has UTAM page objects, `**/__utam__/**` belongs here too.
9. **Editor.** `.vscode/extensions.json` and `.vscode/settings.json` (format on save, ESLint for JavaScript and HTML) - offer, do not impose.
10. **Optional, for teams that publish components:** the README check (`scripts/check-readmes.mjs` as `lint:readme`, with the component folder adjusted to the project) and the Code Analyzer configuration (`code-analyzer.yml`, which keeps only the SLDS rules of the analyzer's ESLint engine, because the project's ESLint already lints the JavaScript).

## Prove it

```bash
npm install
npm run lint
npm run test:unit
node <skill folder>/scripts/lwc-check.mjs
```

A project with components but without tests passes `test:unit` with nothing to run - say so; the tests come with the next change to each component, or as their own task. Lint findings and checker findings in existing components are a list for the team, ranked like a review - not something to fix silently inside the setup change.

## CI

The collection's `.github/workflows/ci.yml` runs Prettier, ESLint, the README check, the Code Analyzer and the Jest tests, with the Salesforce DevOps Starter Kit's actions. Putting the same checks into the team's pipeline is the DevOps Builder's job if it is installed; otherwise use that workflow as the template, and pin every action to its current release (`gh release view -R <owner>/<repo> --json tagName -q .tagName`).
