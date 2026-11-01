# ⚡ LWC Crafter

Build, fix, review and set up Lightning Web Components - built around the [Awesome LWC Collection](https://github.com/svierk/awesome-lwc-collection): ready-to-use components with Jest tests, accessibility checks and documentation, and the project setup around them.

For Salesforce developers. Most problems with Lightning web components are not hard, they are easy to miss: a listener that outlives its component, a cache nobody refreshes, an HTML string in the DOM, an event that never reaches its parent, a color that breaks dark mode. The skill brings the checks for them into every step - and looks for a component to reuse before it writes a new one.

## What it does

| Mode       | Example requests                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Set up** | "Set up ESLint and Jest for our LWC like the Awesome LWC Collection" · "Add accessibility checks to our unit tests"              |
| **Build**  | "Build a component that lists the open cases of an account" · "We need a multi-select picklist in this Flow screen"              |
| **Fix**    | "The component still shows the old value after saving" · "My event never reaches the parent" · "This Jest test fails"            |
| **Review** | "Review our components before the release" · "Are our components ready for SLDS 2?" · "Check this component for security issues" |

- **Set up** brings the collection's quality setup into a Salesforce DX project - ESLint with the LWC rules, Jest with mocks and an accessibility matcher, Prettier with the LWC template parser, pre-commit checks - read from the collection at run time.
- **Build** goes from the need to a green component: standard feature, base component, the collection's catalog and the Salesforce recipes first; then a contract - public properties, events, targets, data source - and the code, tests and documentation along the collection's practices.
- **Fix** names the class of the problem - stale cache, missing state handling, lost event, Lightning Web Security, Apex permissions, leak - before it changes anything, and leaves a test that would have caught it.
- **Review** runs the tools and reads every component against a ranked checklist: security, data, leaks, contracts, accessibility, performance, styling, tests and documentation.

## Practices it applies

Drawn from the collection, the Salesforce LWC Developer Guide and Salesforce's own anti-pattern series:

- **Reuse before you build** - standard feature, base component, collection, recipes, and only then new code.
- **Platform data first, Apex last** - Lightning Data Service, then GraphQL - for lists, related records, aggregates and writes that would otherwise need a custom controller - and Apex only for what neither can do; one data source per record; the cache refreshed after every write.
- **Secure by default** - no HTML strings in the DOM, no dynamic code, libraries as static resources; every `@AuraEnabled` method treated as the public endpoint it is.
- **What a component starts, it stops** - listeners, timers, observers, subscriptions, libraries.
- **SLDS 2 ready** - styling hooks instead of fixed colors and overrides, so themes and dark mode work.
- **Tested, accessible, documented** - Jest tests with an accessibility assertion, a README for every component others place.

## Checking components

The skill ships a checker for the anti-patterns that have one right answer - 40 rules over JavaScript, templates, CSS, `js-meta.xml` and Jest tests, with errors, warnings and infos:

```bash
node scripts/lwc-check.mjs force-app/main/default/lwc/orderSummary
node scripts/lwc-check.mjs --json
```

It complements ESLint with the LWC configuration - it does not replace it. A finding the team decided to keep is suppressed with a comment that gives the reason: `// lwc-check-ignore <rule> -- <reason>`.

## Guardrails

The plugin ships a hook that runs after every file the agent writes in an `lwc` folder. When the file has an error - an API that Lightning Web Security blocks, an HTML string written into the DOM, dynamic code, a script from another host, an Aura global - the findings go straight back to the agent, which fixes them before it continues. Warnings stay out of the hook; they belong in a review. Outside `lwc` folders the hook does nothing, and it needs Node.js, which every LWC project has.

Beyond the hook, the skill:

- previews and deploys only to scratch orgs, sandboxes and developer orgs - it checks the org first and stops on a production org;
- never weakens a test assertion to get green;
- shows changes to dependencies and shared configuration before making them, on a work branch.

To turn the hook off for yourself, set it in your own user settings (`~/.claude/settings.json`) or the project's local, uncommitted ones (`.claude/settings.local.json`) - never in a project's shared settings:

```json
{ "env": { "LWC_CRAFTER_GUARD": "off" } }
```

## Alongside other skills

- [🧪 E2E Automator](../e2e-automator) writes the UTAM page objects and UI tests for your components; the LWC Crafter keeps a component's page object in mind when its markup changes.
- [🧭 DevOps Operator](../devops-operator) takes over for commits, pull requests and failed checks; [🏗️ DevOps Builder](../devops-builder) runs the same checks in the pipeline.
- [🧙 Multi-Framework Wizard](../multi-framework-wizard) owns what a host component frames with `lightning-ui-embedding` - React and Angular UI bundles, apps hosted elsewhere - and how they fit with your components; the host's own code and tests follow the LWC Crafter's practices.
- [🦸 HXL Hero](../hxl-hero) owns HXL widgets - JSON compositions that AI clients render, not components; when an agent action needs a component as renderer, it is built here.
- Salesforce publishes a broad set of LWC skills of its own in [`forcedotcom/afv-library`](https://github.com/forcedotcom/afv-library). The LWC Crafter is the opinionated one - one reference setup, a reuse-first catalog and a guard on every write. Enable one of the two for component work in a project, so they do not compete for the same requests.

## Requirements

- Node.js and npm in the version the project's `package.json` asks for
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with a scratch org, sandbox or developer org authorised for previews and deployments
- [GitHub CLI](https://cli.github.com/) (`gh`) for reading the collection - optional, the skill falls back to the raw files

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install lwc-crafter@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install lwc-crafter@salesforce-skills`.
