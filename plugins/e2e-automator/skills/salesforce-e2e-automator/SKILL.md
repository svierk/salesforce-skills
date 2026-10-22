---
name: salesforce-e2e-automator
description: 'Writes, runs and maintains end-to-end UI tests for Salesforce Lightning with UTAM, WebdriverIO and the Salesforce UTAM E2E Testing template. TRIGGER when: setting up UTAM E2E tests in a Salesforce project or in CI; turning a user story, ticket, acceptance criteria or manual test case into an automated UI test; writing or fixing a UTAM page object (.utam.json) for a Lightning web component or a Lightning page; looking for the Salesforce page object or method for a part of Lightning Experience; running, debugging or stabilising a failing or flaky UTAM test, also when its CI job failed; updating UI tests and page objects after a Salesforce release or a component change; reviewing a UTAM test suite or its coverage. DO NOT TRIGGER when: writing Apex tests, Jest unit tests for Lightning web components or Flow tests; a failed pull request check that is not the UI test job - that is the DevOps Operator; designing or changing the CI/CD pipeline itself - that is the DevOps Builder; UI testing with Selenium, Playwright, Provar or other tools without UTAM.'
license: MIT
---

# Salesforce E2E Automator

Helps developers, testers and test automation engineers build end-to-end UI tests for Salesforce Lightning with [UTAM](https://developer.salesforce.com/docs/platform/utam) - and keep them working. The toolbox is the [Salesforce UTAM E2E Testing](https://github.com/svierk/salesforce-utam-e2e-testing) template: UTAM page objects in JSON, compiled to JavaScript, driven by WebdriverIO and Jasmine, with the Salesforce page objects from the `salesforce-pageobjects` package.

Writing these tests by hand is slow for four reasons: deriving test cases from stories, finding the right page object and method chain for every click, writing JSON page objects for custom components, and repairing tests after every Salesforce release. This skill takes over the mechanical part of each. The person keeps what only they can decide: what the correct behaviour is.

## Pick the mode first

| Mode                 | The user wants to...                                                      | Go to                                |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| **Set up**           | start with UTAM in a project, or run the UI tests in CI                   | [Set up](#set-up)                    |
| **Write a test**     | automate a story, ticket, acceptance criterion or manual test case        | [Write a test](#write-a-test)        |
| **Fix a test**       | make a failing or flaky test green again                                  | [Fix a test](#fix-a-test)            |
| **Upgrade & review** | move to a new Salesforce release, review the suite, find gaps in coverage | [Upgrade & review](#upgrade--review) |

Infer the mode from the repository too: no `utam.config.js` and no `wdio-utam-service` in `package.json` means Set up comes first; a request for a test in a project without the setup runs Set up, then Write a test.

## Ground rules

1. **Fetch facts, don't recall them.** Versions, configuration and the API of every Salesforce page object change with releases. Read versions from npm and the template at run time ([references/sources.md](references/sources.md)), and the page objects from the package the project has installed, with the script below. Never write a page object method you have not seen in `show` output or a `.d.ts` file in this session.
2. **Page objects, not the DOM.** Every interaction goes through a UTAM page object - a Salesforce one, or a JSON page object the project owns. No CSS selectors in specs, no `browser.execute` reaching into shadow roots. If no page object covers a step, write one. Exceptions are a last resort, commented with the reason.
3. **Wait for conditions, never for time.** No `browser.pause`, no sleeps, no blind retries. Waits belong in page objects (`waitFor` with a predicate, `wait: true` on elements) or poll one concrete condition with a timeout message.
4. **Never weaken an assertion to get green.** A red test is information. If the application behaves differently from the acceptance criteria, report it as a possible defect. Change an expected value only when the user confirms the behaviour changed on purpose.
5. **Never test against production.** Tests create and change records. Check the org before the first run (orientation below) and stop if it is a production org.
6. **Keep the session out of sight.** `.env` holds a frontdoor URL that logs anyone in as the test user. Never print it, never commit it, never run `sf org display --verbose` or `sf org open --url-only` where the output lands in the conversation. The template's login script also logs the URL - run it with its output discarded (`npm run test:ui:generate:login >/dev/null`) and check the result with `test -s .env`.
7. **Show before changing shared things.** Dependencies, `wdio.conf.js`, `utam.config.js`, CI workflows and GitHub secrets affect the whole team. Say what changes and why, and make the change on a work branch - named the team's way (`branches` in `.github/salesforce-devops.yml`, if the file exists), never on `main` or another branch that deploys to an org.
8. **Leave the user's defaults alone.** Run tests against another org with `SF_TARGET_ORG=<alias>` on the command, not by changing the project's default org - other work, such as retrieving changes, relies on it.

## Orientation

Once per session, from the project root:

```bash
git status --short --branch
grep -E '"(utam|wdio-utam-service|salesforce-pageobjects|@wdio/[a-z-]+)"' package.json
ls utam.config.js wdio.conf.js force-app/test 2>/dev/null
sf config get target-org --json
sf data query -q "SELECT Name, IsSandbox, OrganizationType, TrialExpirationDate FROM Organization" --json
```

The query runs against the org the tests will use - prefix it with `SF_TARGET_ORG=<alias>` when that is not the default. The org is safe to test against if `IsSandbox` is true, or `TrialExpirationDate` is set (scratch orgs, trials), or `OrganizationType` is `Developer Edition`. Anything else is a production org: stop, say so, and ask for a sandbox. If `sf` has no default org, help the user authorise one (`sf org login web --alias <alias> --set-default`) before anything runs.

## Find page objects

The script in this skill's folder searches the `salesforce-pageobjects` package the project has installed. Run it from the project root:

```bash
node <skill folder>/scripts/find-page-objects.mjs search <term>...       # by tag, class, name or description
node <skill folder>/scripts/find-page-objects.mjs search <term> --root   # only page objects utam.load() can start from
node <skill folder>/scripts/find-page-objects.mjs show <import path>      # exact methods, getters, return types
node <skill folder>/scripts/find-page-objects.mjs show pageObjects/<name>.d.ts   # a compiled page object of the project
```

Search by what the DOM shows: the tag name of a component (`lightning-combobox`, `records-record-layout-item`) finds its page object best. Then `show` every page object on the way and follow the return types - that chain is the test code. Where to start for the common parts of Lightning Experience is in [references/salesforce-page-objects.md](references/salesforce-page-objects.md).

## Set up

Goal: the project compiles page objects and runs one UI test against the user's org - locally, and in CI if wanted.

1. **Read the template at its current state** and compare with the project: dependencies, scripts, `utam.config.js`, `wdio.conf.js`, the login script and helper, ESLint, ignore files. [references/setup.md](references/setup.md) has the checklist, including the fixes a project needs once it has page objects of its own.
2. **Install and wire it in** on a branch. Take versions from npm, not from this skill.
3. **Prove it** with the template's example test or a one-line smoke test against the user's org: compile, generate the login, run.
4. **CI, if wanted.** A workflow that logs in with the JWT bearer flow and runs the suite - nightly, on demand, or after a deployment. Agree with the user when it runs - [references/setup.md](references/setup.md#the-ci-job) has the options. If the project already has a pipeline with the DevOps Starter Kit, reuse its building blocks and the org's GitHub Environment.

## Write a test

Goal: one green, stable spec that checks what the story promises - and nothing the story does not.

1. **Understand the behaviour.** Read the story, ticket, acceptance criteria or manual steps the user gives you - pasted, as a file, an Xray or Jira export, or through a connected tracker. Write a short test plan: persona, starting point, data it needs, steps, expected outcome per step, and what stays out. Ask about gaps instead of inventing behaviour. [references/test-design.md](references/test-design.md) covers what belongs in a UI test at all.
2. **Map every step to a page object.** Standard Lightning UI: find it with the script and follow the chain with `show`. Custom Lightning web components: use their `__utam__` page object, or write one. A step with no page object is a page object to write, never a selector in the spec.
3. **Write or extend custom page objects** for the components the test touches - only the elements and methods the test needs, with waits inside. [references/custom-page-objects.md](references/custom-page-objects.md).
4. **Write the spec** - login, navigation by URL, one behaviour per `it`, data set up and cleaned up through the CLI, outcome verified in the UI and, where it matters, in the database. [references/writing-specs.md](references/writing-specs.md).
5. **Compile, run, iterate.** Compile, read compiler and lint errors, generate a fresh login, run only this spec. On failure, find the cause with [references/run-and-debug.md](references/run-and-debug.md) and fix it in the page object or the spec - rule 4 applies at every iteration.
6. **Prove it is stable.** Two green runs in a row, headless. Then hand over: what is covered, what is not, how to run it, and any behaviour that looked like a defect.

## Fix a test

Goal: the cause of the failure, named and fixed - or reported, if the application is wrong.

1. **Reproduce** with a fresh login and only the failing spec. For a CI failure, read the job log first (`gh run view <run-id> --log-failed`).
2. **Classify** the failure with the table in [references/maintenance.md](references/maintenance.md): setup or session, page object chain, timing, changed component, Salesforce release, data or configuration drift, or a defect in the application. Say which one it is before changing anything.
3. **Fix the cause in the right place.** A timing problem gets a wait in the page object, not a retry loop in the spec; a changed component gets an updated page object, not a workaround. A defect gets reported, with the steps and the evidence - and the test stays red.
4. **Check the neighbours.** A page object fix can change other specs that use it - run them too.

## Upgrade & review

Goal: a suite that runs on the current Salesforce release, and a short, ranked list of what makes it fragile.

- **Release upgrade.** Find the `salesforce-pageobjects` version for the org's release, check the compatible `wdio-utam-service` range, upgrade on a branch, compile, run the whole suite, repair what moved. [references/maintenance.md](references/maintenance.md#salesforce-releases).
- **Review.** Walk the checklist in [references/maintenance.md](references/maintenance.md#review-checklist) - DOM access around page objects, sleeps and retry loops, index-based field access, hard-coded record ids, shared data, weak assertions, missing cleanup. Rank findings by how likely they break a run, each with file, line and fix.
- **Coverage.** List the business processes the suite covers against the ones the user names as critical. Suggest the next tests by risk, not by count.

## Alongside the DevOps skills

This skill does its whole job on its own - set up, CI job, tests, fixes. When the DevOps skills from the same marketplace are installed too, the work splits like this:

- **DevOps Builder** - owns the pipeline around the UI test job: environments, secrets, branch protection, when deployments happen. Changes there are its job; the UI test job itself, and its place in the schedule, stay with this skill. Without the builder, do both, with the same care for secrets.
- **DevOps Operator** - hands over when a pull request's UI test job fails, having already named the job, the test and the step: start at Fix a test with that. Committing tests and opening the pull request is day-to-day work it guides. Its guard blocks commits on environment branches - one more reason to work on a branch.
- **`.github/salesforce-devops.yml`** - read it if it exists: `blueprint` and `environments` place the CI job after the right deployment, `branches` names the work branch. Without it, ask.

## Reference map

- [references/sources.md](references/sources.md) - where every fact lives: template, npm packages, UTAM documentation, examples
- [references/setup.md](references/setup.md) - bringing the template into a project, the fixes for custom page objects, the CI job
- [references/test-design.md](references/test-design.md) - from story to test plan, what belongs in a UI test, test data
- [references/salesforce-page-objects.md](references/salesforce-page-objects.md) - entry points into Lightning Experience, interfaces, containers, record forms
- [references/custom-page-objects.md](references/custom-page-objects.md) - JSON page objects for Lightning web components and pages: rules, grammar, waits, generator
- [references/writing-specs.md](references/writing-specs.md) - spec structure, helpers for login, navigation, fields and data, assertions
- [references/run-and-debug.md](references/run-and-debug.md) - compiling, running, watching the browser, reading errors
- [references/maintenance.md](references/maintenance.md) - failure classes, Salesforce releases, the review checklist
