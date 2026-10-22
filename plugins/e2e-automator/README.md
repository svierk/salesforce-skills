# 🧪 E2E Automator

Write, run and maintain end-to-end UI tests for Salesforce Lightning with [UTAM](https://developer.salesforce.com/docs/platform/utam) - built around the [Salesforce UTAM E2E Testing](https://github.com/svierk/salesforce-utam-e2e-testing) template.

For developers, testers and test automation engineers. The skill takes over the parts of UTAM testing that cost the most time by hand: finding the right page object and method chain for every click, writing JSON page objects for custom Lightning web components, getting the waits right, and keeping tests and page objects working through Salesforce releases.

## What it does

| Mode                 | Example requests                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Set up**           | "Add UTAM E2E tests to this project" · "Run our UI tests in GitHub Actions every night against UAT"                     |
| **Write a test**     | "Turn ABC-123 into a UI test" · "Test that a sales rep can convert a lead" · "Write a page object for c-product-filter" |
| **Fix a test**       | "The opportunity test fails since yesterday" · "This test is flaky" · "Element not found in recordLayout"               |
| **Upgrade & review** | "Update our page objects to the new Salesforce release" · "Review our UI tests" · "Which processes are not covered?"    |

- **Set up** brings the template's configuration into an existing Salesforce DX project - dependencies, compiler and runner config, login helper, CI job - read from the template at run time, plus the fixes a project needs once it has page objects of its own.
- **Write a test** goes from a story, ticket or manual test case to a short test plan, maps every step to a Salesforce or custom page object, writes the spec, compiles, runs it against a sandbox and iterates until it is green - without weakening a single assertion.
- **Fix a test** reads the failure, classifies it - session, page object chain, timing, changed component, data or configuration drift, or a real defect - and fixes the cause, not the symptom.
- **Upgrade & review** moves `salesforce-pageobjects` to the current Salesforce release, repairs what the release changed, and audits a suite for the patterns that make UI tests flaky.

## Finding page objects

Salesforce publishes more than a thousand page objects for Lightning Experience in the [`salesforce-pageobjects`](https://www.npmjs.com/package/salesforce-pageobjects) package, one major version per release. The skill ships a script that searches the package the project has installed and prints the exact API of a page object - so tests are written against the release the project uses, not against memory or an outdated example:

```bash
node scripts/find-page-objects.mjs search lightning-combobox
node scripts/find-page-objects.mjs show salesforce-pageobjects/global/pageObjects/recordActionWrapper
```

It complements the [UTAM Chrome extension](https://developer.salesforce.com/docs/platform/utam/guide/browser-extension.html), which finds page objects on a live page.

## Guardrails

- Tests run against sandboxes, scratch orgs and developer orgs only - the skill checks the org before the first run and stops on a production org.
- A failing assertion is information, not an obstacle. The skill never relaxes an expected value to make a test pass; when behaviour changed on purpose, it asks first.
- The login URL in `.env` is a live session. The skill keeps it out of the conversation and out of Git.

## Requirements

- Node.js and npm in the version the project's `package.json` asks for
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with a sandbox, scratch org or developer org authorised
- Google Chrome - WebdriverIO drives it, headless by default
- [GitHub CLI](https://cli.github.com/) (`gh`) for reading the template and setting up CI - optional

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install e2e-automator@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install e2e-automator@salesforce-skills`.
