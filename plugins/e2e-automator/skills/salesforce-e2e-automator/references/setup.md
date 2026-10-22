# Set up

Bring UTAM end-to-end tests into a Salesforce DX project, prove them against the user's org, and - if wanted - run them in GitHub Actions. Read each file from the template ([sources.md](sources.md)) at the moment you need it; this page says what to take and what to adjust, not what the files contain.

## New project or existing one

- **New project** - create it from the template and adapt names: `gh repo create <owner>/<name> --private --template svierk/salesforce-utam-e2e-testing --clone`. Change `name` in `package.json` and `sfdx-project.json`, and the scratch org definition.
- **Existing project** - the usual case. Bring in only the UTAM lane, on a work branch named the team's way (`branches` in `.github/salesforce-devops.yml`, if it exists; otherwise something like `chore/e2e-tests`), and leave the project's own tooling as it is.

## Checklist for an existing project

Compare each item with the project before writing, and show the user the list of changes first.

1. **Node version.** The template's `engines.node` is what its dependencies are tested with. If the project pins an older Node, say so - upgrading Node is the team's decision.
2. **Dependencies.** Add the packages the UTAM lane needs, in their current versions from npm: `utam`, `wdio-utam-service`, `salesforce-pageobjects`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/jasmine-framework`, `@wdio/spec-reporter`, `dotenv`, and the Babel packages the template uses to load specs (`@babel/core`, `@babel/preset-env`, `@babel/register`, plus `babel.config.js` if the project has none). `eslint-plugin-wdio` and `eslint-plugin-jasmine` if the project lints specs. Check the `wdio-utam-service` range in the `salesforce-pageobjects` README before you pick versions.
3. **npm scripts.** `test:ui`, `test:ui:compile`, `test:ui:generate:login` as in the template. Keep the names - the CI job and this skill use them.
4. **`utam.config.js`.** Take the template's file, then set the alias for the project's own page objects to a relative path:

   ```js
   alias: { 'utam-sfdx/': '../' }
   ```

   The compiler writes page objects to `pageObjects/` and turns a type `utam-sfdx/pageObjects/x` into an import of `<alias>pageObjects/x`. An alias to the package name, as in older copies of the template, only resolves if the package can import itself - with npm and no `exports` in `package.json`, a page object that contains another custom page object then fails at run time with `Cannot find module`. `'../'` resolves from `pageObjects/` to its sibling files and always works.

5. **`wdio.conf.js`.** Take it with its comments. Adjust `specs` if the project keeps tests elsewhere than `force-app/test/**/*.spec.js`. Offer a switch for a visible browser instead of commenting lines in and out - for example `HEADED=true` leaving out `--headless=new` - see [run-and-debug.md](run-and-debug.md#watch-the-browser).
6. **Login.** `scripts/generate-login-url.js`, `force-app/test/utam/utam-helper.js` and the `beforeSession` hook in `wdio.conf.js` from the template. The hook asks the CLI's default org for a fresh frontdoor URL for every browser session - such a URL works only once, and every spec file is a session of its own; the helper opens it and waits for Lightning. A project with an older copy that writes the URL into `.env` once per run fails at login from its second spec file on - bring the hook in.
7. **`.gitignore`.** `.env` (a live session), `pageObjects/` (compiler output - generated, never edited), `utam-lint.sarif`.
8. **`.forceignore`.** `**/__utam__/**` and `force-app/test/**`. Page objects live next to the components in `lwc/<component>/__utam__/`, and specs inside the package directory; neither belongs in the org. Without these lines, deploying a component picks up its page object as part of the bundle - Salesforce's own UTAM samples ignore both for that reason.
9. **ESLint.** The template's block for `force-app/test/utam/**/*.js` declares the `utam`, `browser` and Jasmine globals, and the browser globals for callbacks that run in the page. Without it, every spec is full of `no-undef` errors.
10. **Prettier and lint-staged** already cover `.js` and `.json` in most projects; `.utam.json` files are JSON and need nothing extra.

## Prove it

```bash
npm install
npm run test:ui:compile           # compiles every __utam__/*.utam.json - none yet is fine
npm run test:ui -- --spec <spec>  # one spec
```

Prefix the run with `SF_TARGET_ORG=<alias>` if the tests should not use the default org. Start with one of the template's example specs - they run in an org of any language - or a smoke test that logs in and checks the app name in the navigation bar. A green run proves Node, Chrome, WebdriverIO, the UTAM service, the login and the org together; everything after that is test code.

## The CI job

Read the `tests` job of the template's `.github/workflows/ci.yml` and the conventions in its README, then adapt:

- **Pins.** Every `uses:` points to the exact latest release of that action, looked up now: `gh release view -R <owner>/<repo> --json tagName -q .tagName` - for `actions/checkout` as for the kit's `svierk/get-node-version`, `svierk/sfdx-cli-setup` and `svierk/sfdx-login`.
- **When it runs.** A UI test checks what is deployed in the org, not what is in the pull request. Good triggers: a nightly `schedule` and `workflow_dispatch` against a test sandbox; `workflow_run` after the deployment workflow of that stage; per pull request only where the change is deployed first, such as a scratch org per pull request in blueprint B3. Running UI tests on a pull request against a sandbox that does not have the change tests yesterday's state - say so if the user asks for it.
- **Login.** JWT bearer flow through `svierk/sfdx-login`. If the DevOps Builder set the repository up, the org's GitHub Environment already holds `SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY` and `SFDX_USERNAME` as secrets - use its validation twin (`environment: uat-validation`), which has the same secrets and no reviewers, so the job does not wait for an approval. Otherwise follow the template: two secrets and the username as a repository variable.
- **The test user.** The pipeline's integration user is often API-only, and an API-only user cannot open the UI - the login then never reaches Lightning. Use a dedicated test user per persona, with the profile and permission sets of the people the test stands for. Its username is the one the job logs in with.
- **Forks.** Keep the template's `if:` that skips the job for pull requests from forks - they get no secrets.
- **Evidence.** Offer a screenshot on failure: an `afterTest` hook in `wdio.conf.js` that calls `browser.saveScreenshot()` when `passed` is false, and an `actions/upload-artifact` step with `if: failure()`. Triage without a screenshot is guesswork.

Setting secrets and variables changes the repository for everyone: show the commands, pipe key files instead of pasting them (`gh secret set SFDX_JWT_SECRET_KEY < server.key`), and run them after the user confirms. The certificate, the connected app or external client app and the integration user are the same as for any Salesforce pipeline with the JWT bearer flow. If the project already has them, reuse them for the login and add the test user; if not, walk the user through the authentication guide of the DevOps Starter Kit (`docs/authentication.md` in `svierk/salesforce-devops-starter-kit`) - or let the DevOps Builder do it, if it is installed.
