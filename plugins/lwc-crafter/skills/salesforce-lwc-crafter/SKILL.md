---
name: salesforce-lwc-crafter
description: 'Builds, fixes, reviews and sets up Lightning Web Components the way the Awesome LWC Collection does - reuse first, platform data, secure, tested and accessible. TRIGGER when: creating or changing a Lightning web component (files under lwc/); looking for a ready-made component; choosing how a component gets its data (LDS, GraphQL, Apex) or talks to others (events, Lightning Message Service); a component shows stale data, does not render, loses events or throws in the browser; writing or fixing Jest tests for components; reviewing components for security, performance, accessibility or SLDS 2; setting up ESLint, Jest and Prettier for LWC. DO NOT TRIGGER when: Aura or Visualforce only; Apex that no component calls; UTAM page objects or UI tests - that is the E2E Automator; commits, pull requests or a failed pipeline check - that is the DevOps Operator; pipeline design - that is the DevOps Builder.'
license: MIT
---

# Salesforce LWC Crafter

Helps developers build Lightning Web Components (LWC) that hold up in production - and keep existing ones in shape. The reference is the [Awesome LWC Collection](https://github.com/svierk/awesome-lwc-collection): ready-to-use components with Jest tests, accessibility checks and documentation, and the project setup around them - ESLint, Jest, Prettier, pre-commit checks.

Most problems with Lightning web components are not hard, they are easy to miss: a listener that outlives its component, a cache that nobody refreshes, an HTML string in the DOM, an event that never reaches its parent, a color that breaks dark mode. This skill brings the checks for them into every step, so the developer can concentrate on what the component should do.

## Pick the mode first

| Mode       | The user wants to...                                                                      | Go to             |
| ---------- | ----------------------------------------------------------------------------------------- | ----------------- |
| **Set up** | bring LWC quality tooling - ESLint, Jest, accessibility checks, Prettier - into a project | [Set up](#set-up) |
| **Build**  | a new component, or a new feature in an existing one                                      | [Build](#build)   |
| **Fix**    | make a broken component or a failing Jest test work again                                 | [Fix](#fix)       |
| **Review** | audit components before a release, a pull request or the switch to SLDS 2                 | [Review](#review) |

Infer the mode from the repository too: a project without `@salesforce/sfdx-lwc-jest` and an LWC ESLint configuration gets Set up offered before the first component - not forced, the user decides.

## Ground rules

1. **Fetch facts, don't recall them.** Base component attributes, wire adapter signatures, targets, package versions and the collection itself change. Read them from their source at run time ([references/sources.md](references/sources.md)). Never use an attribute, adapter or target you have not seen in the documentation or the project in this session.
2. **Reuse before you build.** A standard feature, a base component (`lightning-*`), a component of the collection or a Salesforce recipe beats new code. Build only what none of them covers - [references/design.md](references/design.md#reuse-before-you-build).
3. **Platform data first.** Lightning Data Service before GraphQL before Apex, one data source per record, `@salesforce/schema` imports instead of field names as strings - [references/data.md](references/data.md).
4. **Secure by default.** No HTML strings in the DOM, no dynamic code, no scripts from other hosts. Every `@AuraEnabled` method is a public endpoint: `with sharing`, user mode, bind variables, allowlists - [references/security.md](references/security.md).
5. **The template renders, the component cleans up.** Declarative templates over DOM work, `lwc:ref` over selectors. What a component starts - listeners on `window` or `document`, timers, observers, subscriptions, libraries - it stops in `disconnectedCallback` - [references/runtime.md](references/runtime.md).
6. **Tested, accessible, documented.** Every component ships with Jest tests that include an accessibility assertion, and a public one with a README. Never weaken an assertion to get green; change an expected value only when the user confirms the behaviour changed on purpose.
7. **Green before done.** A change is done when the project's checks pass: Prettier, ESLint, Jest, and the checker of this skill. Run them through the project's npm scripts or `node_modules/.bin` - never a bare `npx <tool>`, which fetches whatever version is current and fails on the project's configuration. Say what ran and what it found - never report a check you did not run.
8. **Never deploy to production, never move the user's defaults.** Preview with Local Dev or deploy single bundles to a scratch org, sandbox or developer org - check the org first (orientation below). Use `--target-org <alias>` on the command instead of changing the default org.
9. **Show before changing shared things.** Dependencies, ESLint, Jest and Prettier configuration and Git hooks affect the whole team. Say what changes and why, and change it on a work branch - named the team's way (`branches` in `.github/salesforce-devops.yml`, if the file exists), never on `main` or another branch that deploys to an org.

The plugin ships a guard that enforces part of rule 4: after every write to a file in an `lwc` folder, the errors of the checker below go straight back to you. Fix them before you continue. Suppress one only when the user decided to keep it, with the reason in the comment.

## Orientation

Once per session, from the project root - the Salesforce DX project the user works in, never this skill's folder:

```bash
git status --short --branch
cat sfdx-project.json
ls -d node_modules >/dev/null 2>&1 || echo "dependencies not installed - run npm install (or npm ci) before any check"
node -e "const p=require('./package.json'); console.log(JSON.stringify({engines:p.engines, scripts:p.scripts, devDependencies:p.devDependencies, 'lint-staged':p['lint-staged']}, null, 2))"
ls eslint.config.* .eslintrc* jest.config.* jest-setup.* .prettierrc* .husky .forceignore 2>/dev/null
find . -path ./node_modules -prune -o -type d -name lwc -print
```

Take the project's conventions from what is there - npm script names, folder layout, naming, test style, the `sourceApiVersion` for new components - and follow them over this skill's defaults. Before the first deployment or preview, check the org:

```bash
sf data query -q "SELECT Name, IsSandbox, OrganizationType, TrialExpirationDate FROM Organization" --target-org <alias> --json
```

Safe if `IsSandbox` is true, `TrialExpirationDate` is set (scratch orgs, trials) or `OrganizationType` is `Developer Edition`. Anything else is a production org: stop and ask for another one.

## Check components

The script in this skill's folder checks component bundles for the anti-patterns that have one right answer:

```bash
node <skill folder>/scripts/lwc-check.mjs force-app/main/default/lwc/<component>   # one component
node <skill folder>/scripts/lwc-check.mjs                                          # every lwc folder below the working directory
node <skill folder>/scripts/lwc-check.mjs <paths> --errors-only                    # what the guard checks
node <skill folder>/scripts/lwc-check.mjs <paths> --json                           # for further processing
```

Errors break or endanger the component and fail the run; warnings belong in every review; infos are hints. The rules are listed in [references/review.md](references/review.md#checker-rules). The checker complements ESLint with the LWC configuration - it does not replace it - and judgement does the rest.

## Set up

Goal: the project lints, formats and tests Lightning web components the way the collection does, locally and before every commit.

1. **Compare** the project with the collection's setup, read at its current state: dependencies, npm scripts, ESLint, Jest with its mocks and the accessibility matcher, Prettier with the LWC template parser, pre-commit checks, `.forceignore`. [references/setup.md](references/setup.md) has the checklist.
2. **Show the list of changes** and make them on a work branch after the user agreed. Take versions from npm, not from this skill.
3. **Prove it:** `npm install`, then the project's lint and unit test scripts, then the checker over all components. Existing findings are a list for the team, not a reason to stop - offer a review.
4. **CI.** Running the same checks in the pipeline is the DevOps Builder's job if it is installed; otherwise the collection's workflow shows a complete job.

## Build

Goal: a component that does what the user needs, built from as little new code as possible, green on every check.

1. **Understand the need.** What the user sees and does, where the component lives (record page, app or home page, Flow screen, quick action, Experience Cloud, mobile), which data it reads and writes, who uses it with which permissions, which languages. Ask about gaps instead of inventing behaviour.
2. **Look for something to reuse** - standard feature, base component, the collection's catalog, the Salesforce recipes - in that order. If something fits, use it or copy it with its tests, Apex and documentation, and run the checker on the copy. [references/design.md](references/design.md#reuse-before-you-build).
3. **Design the contract before the code:** name, public properties and methods, events with their `detail`, targets and their properties, the data source for each need, user-facing text. For anything beyond a small change, show the user a short design and agree on it. [references/design.md](references/design.md), [references/data.md](references/data.md).
4. **Write the bundle.** Generate it with `sf template generate lightning component --type lwc --name <name> --output-dir <lwc folder>` - without `--type lwc` the CLI creates an Aura component. Write it along [references/runtime.md](references/runtime.md), [references/styling-and-accessibility.md](references/styling-and-accessibility.md) and [references/security.md](references/security.md). Apex the component needs follows [references/data.md](references/data.md#apex) and gets its own test class.
5. **Write the tests** - rendering from public properties, every user interaction, data, empty and error states, and an accessibility assertion. [references/testing.md](references/testing.md).
6. **Run the checks:** Prettier, ESLint, Jest - the project's scripts - and the checker on the bundle. Fix causes; never disable a rule to get green.
7. **See it working.** Local Dev (`sf lightning dev component --name <name> --target-org <alias>`, check `--help` for the installed version), or deploy the bundle alone: `sf project deploy start --source-dir <bundle> --target-org <alias>`. You cannot see the screen - ask the user to look, and to try it with the keyboard.
8. **Hand over:** what the component does, its public API, where and how to place it, what the tests cover, what is open. A component others will place gets a README - [references/documentation.md](references/documentation.md). Committing and the pull request are day-to-day work for the DevOps Operator, if installed.

## Fix

Goal: the cause named and fixed, with a test that would have caught it.

1. **Reproduce.** Prefer a failing Jest test; otherwise the steps in the org, with the browser console. Ask the user for the console error and what they did - you cannot see their browser.
2. **Classify** with the symptom table in [references/review.md](references/review.md#diagnosing-a-broken-component): stale data, nothing renders, lost event, error from a distortion or the CSP, Apex error, works locally but not in the org. Say which one it is before changing anything.
3. **Fix the cause in the right place** - a cache that is not refreshed gets a refresh, not a page reload; a leak gets a cleanup, not a guard flag.
4. **Prove it:** the test is green, the other tests of the component still are, the checker is clean for the files you touched.

## Review

Goal: a short, ranked list of what will break or hurt first - each finding with file, line, why and the fix.

1. **Scope:** the components the user names, the changed bundles (`git diff --name-only <base>...HEAD -- '**/lwc/**'`) or every component.
2. **Run the tools:** the checker, the project's ESLint and Jest; the SLDS Linter and the Salesforce Code Analyzer if SLDS 2 or Apex security is in scope.
3. **Read** every bundle in scope with the checklist in [references/review.md](references/review.md#review-checklist) - the tools find patterns, the checklist finds design problems they cannot see.
4. **Report** ranked by impact: security, wrong or stale data, leaks, broken contracts, accessibility, performance, styling, tests, documentation. Mark which findings a tool reported and which are judgement. End with what is already good, so the team knows what not to touch.

## Alongside the other skills

This skill does its whole job on its own. When other skills from the same marketplace are installed, the work splits like this:

- **E2E Automator** - owns UTAM page objects and UI tests. A change to a component's markup can break its page object in `__utam__/`: update it in the same change, or name it in the handover. Stable `data-id` attributes on elements a test needs make both easier.
- **DevOps Operator** - commits, pull requests, failed checks, promotions. Hand over when the component is green; take it back when a check on the pull request fails in ESLint or Jest.
- **DevOps Builder** - runs the checks in the pipeline. Keep the npm script names stable - pipelines call them.
- **`.github/salesforce-devops.yml`** - read it if it exists: `branches` names the work branch. Without it, ask.

## Reference map

- [references/sources.md](references/sources.md) - where every fact lives: the collection and its catalog, Salesforce recipes, documentation, npm packages, CLI
- [references/setup.md](references/setup.md) - the quality setup for a project: dependencies, scripts, ESLint, Jest, Prettier, pre-commit checks, `.forceignore`
- [references/design.md](references/design.md) - reuse before you build, component boundaries, public API, events and communication, targets, text
- [references/data.md](references/data.md) - choosing the data source, Lightning Data Service, GraphQL, Apex, keeping the cache fresh, errors
- [references/runtime.md](references/runtime.md) - templates, reactivity, lifecycle, DOM access, third-party libraries, async work, performance
- [references/styling-and-accessibility.md](references/styling-and-accessibility.md) - SLDS 2 and styling hooks, dark mode, accessibility, localization
- [references/security.md](references/security.md) - Lightning Web Security, Content Security Policy, unsafe APIs, Apex as an endpoint
- [references/testing.md](references/testing.md) - Jest tests: shape, wire adapters, Apex, events, toasts, accessibility, what not to do
- [references/documentation.md](references/documentation.md) - README, JSDoc and metadata that tell others how to use a component
- [references/review.md](references/review.md) - checker rules, review checklist, diagnosing a broken component
