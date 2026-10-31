---
name: salesforce-multi-framework-wizard
description: 'Designs, builds, embeds, reviews and fixes Salesforce Multi-Framework applications the way Polyglot Arcade does - React and Angular UI bundles, Lightning web components and externally hosted apps sharing one org''s data, composed on Lightning pages as microfrontends, with Agentforce where it helps. TRIGGER when: choosing between LWC, a React or Angular UI bundle and an externally hosted app, or deciding how several of them fit together; designing surfaces, roles, navigation, integration patterns or the data contract of a multi-framework app; scaffolding or wiring a UI bundle (UIBundle metadata, Data SDK, App Launcher app, ui-bundle.json); embedding an app in a Lightning or Experience Cloud page with lightning-ui-embedding, the View SDK or the package-free bridge; props and events between a host LWC and an embedded app; checking whether an org is ready for Multi-Framework; adding the Agentforce Conversation Client to a UI bundle or letting an agent work on the same data as the apps; an embedded app stays blank, a UI bundle does not open or its deploy fails; reviewing a multi-framework architecture or writing its decision records. DO NOT TRIGGER when: a Lightning web component that hosts no embedded app - that is the LWC Crafter; authoring or testing the agent itself (Agent Script, topics, actions); UTAM UI tests - the E2E Automator; commits, pull requests and pipelines - the DevOps Operator and DevOps Builder; Visualforce, Aura or backends without a Salesforce UI.'
license: MIT
---

# Salesforce Multi-Framework Wizard

Helps architects and developers build Salesforce apps with more than one UI framework - React and Angular UI bundles, Lightning web components, apps hosted outside Salesforce - that share one org's data and meet on Lightning pages as microfrontends. The reference is [Polyglot Arcade](https://github.com/svierk/polyglot-arcade): an Angular hub, a React cabinet, a Lightning app that composes them and an LWC OSS game on Vercel, built along four integration patterns and documented with architecture decision records.

Multi-framework apps rarely fail in one framework. They fail between them: two surfaces that both claim to be the entry point, a frame that stays blank because a trusted site is missing, a link that opens an empty Lightning app, a guest that writes data nobody validates, a URL that only works in one org. This skill puts those seams first - the roles, the data contract, the channels and the trust boundaries - so each framework can do what it is good at.

## Pick the mode first

| Mode           | The user wants to...                                                                                     | Go to                     |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Design**     | decide which framework and surface does what, and how they connect - before or instead of code           | [Design](#design)         |
| **Build**      | scaffold or extend a React or Angular UI bundle and wire it to the org, the data and the other surfaces  | [Build](#build)           |
| **Embed**      | show an app - a UI bundle or one hosted anywhere - inside a Lightning or Experience Cloud page           | [Embed](#embed)           |
| **Agentforce** | bring an agent into the architecture: a conversation in a UI bundle, an agent on the same data, agent UI | [Agentforce](#agentforce) |
| **Fix**        | make a blank frame, a bundle that does not open, a broken link or a failing deploy work again            | [Fix](#fix)               |
| **Review**     | audit an existing multi-framework project or design before a release, a pull request or an upgrade       | [Review](#review)         |

Infer the mode from the repository too: a project without `uiBundles/` gets Design offered before the first bundle, a project with host LWCs but no trusted sites gets Review offered - not forced, the user decides.

## Ground rules

1. **Fetch facts, don't recall them.** Multi-Framework changes with every release: what is generally available, in beta or not supported yet, which frameworks internally hosted embedding accepts, the exports of `@salesforce/platform-sdk`, the templates, the org requirements. Read them from their source at run time ([references/sources.md](references/sources.md)) and name the release a fact belongs to. Polyglot Arcade is a verified fixed point - what worked in a real org on a known release - not the current truth. Never use an SDK function, template, attribute or setting you have not seen in the documentation, the package or the project in this session.
2. **One role per surface.** Every surface has one job: one entry point, machines that do one thing, and Lightning where microfrontends are composed. Name the role before writing code - [references/architecture.md](references/architecture.md#one-role-per-surface).
3. **Each framework where it fits.** LWC where admins place components and records live, a UI bundle for an app with its own routes, state or real-time loop, an external app where one exists or another team owns it. Team skills count. A framework is never chosen to show it off - [references/architecture.md](references/architecture.md#choosing-a-surface).
4. **The data is the contract.** Surfaces do not call each other for data. They read and write the same records through the UI API - Data SDK GraphQL in UI bundles, Lightning Data Service and the GraphQL wire in LWC - under the user's sharing and field-level security. Where an app lives and how it integrates is configuration on a record, not code. Apex only for what the UI API cannot do, with the reason named - [references/data-and-security.md](references/data-and-security.md).
5. **Every embedded app has a pattern and a writer.** For each frame, say whether the guest is internally or externally hosted and who saves its data: the guest with the user's session, or the host on its behalf after validating the input - [references/architecture.md](references/architecture.md#integration-patterns).
6. **Trust boundaries are explicit.** What a guest sends is untrusted input. Messages go to one exact origin, trusted sites allow framing and nothing else, no session or token reaches an external guest, no org-specific URL is hard-coded - [references/data-and-security.md](references/data-and-security.md#trust-boundaries).
7. **Every surface works on its own.** A UI bundle runs standalone and embedded, a guest behaves as before when it is not framed, and both are tested without an org. The View SDK resolves to an empty object off an embedding surface - feature-detect every call.
8. **Verify platform behaviour in an org, then write it down.** A claim like "a hidden app cannot be launched" or "the bundle URL is the App Launcher start URL" is checked in a scratch org before a design relies on it, and recorded in the decision record's Verification section.
9. **Never touch production, never move the user's defaults.** Deploy and set up only in scratch orgs, sandboxes and developer orgs - check the org first (orientation below). Use `--target-org <alias>` instead of changing the default org; a dev server that proxies to the default org is a reason to ask, not to change it.
10. **Show before changing org-wide settings.** CSP Trusted Sites, trusted domains for inline frames, My Domain settings such as the Edge Network or the first-party cookie requirement, session settings and permission sets affect every user. Show the exact change and its trade-off, and wait for a yes.
11. **Green before done.** A change is done when every surface it touches passes its checks - lint, unit tests and build of each bundle, Jest for the LWCs, the X-ray of this skill. Say what ran and what it found - never report a check you did not run.

## Orientation

Once per session, from the project root - the Salesforce DX project the user works in, never this skill's folder:

```bash
git status --short --branch
cat sfdx-project.json
find . -path ./node_modules -prune -o -name '*.uibundle-meta.xml' -print
find . -path ./node_modules -prune -o -name '*.html' -path '*/lwc/*' -print | xargs grep -l 'lightning-ui-embedding' 2>/dev/null
node <skill dir>/scripts/xray.mjs
```

The X-ray maps the project - UI bundles with their framework, App Launcher apps, host LWCs, trusted sites, message channels - and reports what breaks between the surfaces ([Checking the architecture](#checking-the-architecture)). Take the project's conventions from what is there - folder layout, naming, the router, the data client, test runners - and follow them over this skill's defaults. Before the first deployment or setup, check the org:

```bash
node <skill dir>/scripts/preflight.mjs --target-org <alias>
```

It reports whether the org is a production org, its API version, whether it knows the `UIBundle` metadata type, its instance (Hyperforce), its default language and the Salesforce Edge Network - each with a hint. A production org: stop and ask for another one. The other findings are warnings; [references/org-and-deploy.md](references/org-and-deploy.md#requirements) says which feature each one blocks.

## Checking the architecture

The skill ships a checker for what has one right answer between the surfaces - org-relative links that cannot launch a bundle, hard-coded `*.salesforce.app` URLs, frames that cannot remount, unseen embedding errors, messages to any origin, wildcard trusted sites, the SDK in an LWR app and more:

```bash
node <skill dir>/scripts/xray.mjs [project root] [--errors-only] [--json] [--mermaid]
```

`--mermaid` prints the map as a diagram to start a design document from. Errors break a surface or open it up, warnings are worth a look in every review, infos are hints; the exit code is 1 when there is an error. The rules are in [references/review.md](references/review.md#x-ray-rules). A finding the team decided to keep is suppressed on its line or the line above, with the reason: `// xray-ignore <rule> -- <reason>`.

## Design

Goal: an architecture the team agrees on before code - surfaces with roles, patterns, the data contract and the channels, as a diagram and decision records.

1. **Users and their jobs.** Who uses it - employees, customers, partners, the public - where they already work (a Lightning record, the App Launcher, an Experience Cloud site, the mobile app, outside Salesforce), and what exists already: components, external apps, the team's frameworks. Read the requirements and the existing repository yourself instead of asking for what is written down.
2. **A surface per job** with the questions in [references/architecture.md](references/architecture.md#choosing-a-surface). Say for each why it is that surface and not the next one.
3. **Roles and navigation.** One entry point; machines launched from it; Lightning as the floor where frames are composed. How a user gets from each surface to each other one and back - [references/architecture.md](references/architecture.md#navigation-between-surfaces).
4. **An integration pattern per embedded app or agent touchpoint**, with who writes the data - [references/architecture.md](references/architecture.md#integration-patterns), [references/agentforce.md](references/agentforce.md).
5. **The data contract.** Objects and fields every surface reads and writes, the configuration records that say where each app lives, the permission set, what is validated where - [references/data-and-security.md](references/data-and-security.md).
6. **The channels.** One job per channel: data through the UI API, props down, events up, Lightning Message Service across the page - [references/architecture.md](references/architecture.md#communication).
7. **Check the platform for the org's release** ([references/sources.md](references/sources.md)): is the pattern generally available, in beta, supported for this framework and this host surface? Verify the risky assumptions in a scratch org.
8. **Write it down:** an architecture overview with one Mermaid diagram, a diagram per pattern, a sequence per interaction that crosses a frame, and an ADR per decision that rules out an option - [references/architecture.md](references/architecture.md#decision-records). Hand it over for agreement before Build.

## Build

Goal: a UI bundle that runs standalone, deploys with one command, reads and writes the shared data, and reaches the other surfaces.

1. **Start from the template.** New project or bundle with the Salesforce CLI templates - list them with `sf template generate project --help` and `sf template generate ui-bundle --help`, never from memory. Keep the template's build, lint and test configuration and its license headers - [references/ui-bundles.md](references/ui-bundles.md#scaffold).
2. **Metadata that launches it:** the UIBundle, its Custom Application with `uiBundle`, and a permission set that makes the app visible - [references/ui-bundles.md](references/ui-bundles.md#anatomy).
3. **One data client.** Wrap `createDataSDK()` in one module or service; on top, named operations per surface. Fetch the org's schema and generate the operation types; live reads skip the cache - [references/ui-bundles.md](references/ui-bundles.md#data).
4. **Logic outside the framework.** Rules and calculations in framework-free TypeScript with unit tests; components render and handle input - [references/ui-bundles.md](references/ui-bundles.md#structure-that-survives-three-frameworks).
5. **Links to the other surfaces** from `SFDC_ENV` and configuration records, never typed-in URLs - [references/architecture.md](references/architecture.md#navigation-between-surfaces).
6. **Build, deploy, connect.** Build every bundle against the target org before the deploy - the bundle ships its build output and bakes in the org's API version. A setup that runs preflight, build, deploy, permission set, seed data and the connect step in order, and is safe to run again - [references/org-and-deploy.md](references/org-and-deploy.md#one-command-setup).
7. **Test without an org:** unit tests, Playwright against the static build with axe and touch, Jest for the LWCs - [references/ui-bundles.md](references/ui-bundles.md#tests-without-an-org).
8. **See it working.** Check it yourself first: `sf api request graphql --body <file with the plain GraphQL operation> --target-org <alias>` shows what the bundle's query returns, and headless Playwright can sign in through `sf org open --url-only` - used in-process, never printed - open the app's `AppMenuItem.StartUrl` and take a screenshot. Then ask the user to open the app from the App Launcher and to try it with the keyboard.

## Embed

Goal: an app framed on a Lightning or Experience Cloud page that loads, receives its props, reports back, and stays inside the trust settings.

1. **Classify the guest:** an internally hosted UI bundle or an externally hosted app. Check the current status and framework support of the kind you need ([references/sources.md](references/sources.md#salesforce-documentation)) and tell the user if it is beta.
2. **The host LWC** - keyed frame, cached props, errors shown, configuration from a record with an override for local development - [references/embedding.md](references/embedding.md#the-host-lwc). Its tests, accessibility and styling follow the LWC Crafter's practices if it is installed.
3. **The guest side:** the View SDK where the app can load `@salesforce/platform-sdk`, the package-free bridge where it cannot (LWR, LWC OSS, stacks without npm) - [references/embedding.md](references/embedding.md#the-guest-with-the-sdk).
4. **The contract:** props shape, event names and `detail` in both directions, documented on both sides with mirrored types, and who saves - [references/embedding.md](references/embedding.md#who-saves).
5. **Trust settings:** the CSP Trusted Site for the guest's origin with frame-src only, plus the extra settings for Experience Cloud hosts - shown to the user before anything is deployed (rule 10) - [references/embedding.md](references/embedding.md#trust-settings).
6. **Fan-out:** after a result, a toast and a Lightning Message Service message, so other components on the page refresh.
7. **Prove it:** the frame fires its ready event, a round trip of props and an event works, the X-ray is clean. Local iteration with a dev server and development-only trusted sites - [references/embedding.md](references/embedding.md#local-development).

## Agentforce

Goal: the agent in the place where it helps, on the same data and rules as the apps - not a second backend.

1. **Pick the touchpoint** ([references/agentforce.md](references/agentforce.md)): a conversation inside a UI bundle (Agentforce Conversation Client), an agent that answers from and acts on the apps' records, agent output rendered as UI (Lightning types and widgets), or the apps' data offered to other AI clients. A real-time interaction - a game loop, a drag-and-drop board - stays UI.
2. **Check the release:** which of these is generally available or in beta, for which framework, and what the org needs. The Conversation Client needs org-wide session and My Domain changes - rule 10.
3. **Keep one data path.** The agent's actions read and write the same objects under the same permissions; what an agent changes is validated like what any guest sends.
4. **Hand over the agent itself.** Authoring, testing and deploying the agent - Agent Script, topics, actions - belongs to an agent skill, such as Salesforce's `agentforce-adlc`; this skill owns where it plugs into the architecture.

## Fix

Goal: the cause named and fixed in the right surface, with the check that would have caught it.

1. **Reproduce** and collect what the platform says: the browser console, the error event of the frame (`code`, `message`, `phase`), the deploy output, the preflight. Ask the user for what you cannot see.
2. **Classify** with the symptom table in [references/review.md](references/review.md#diagnosing): blank frame, frame error code, props or events that never arrive, bundle that does not open, link into the wrong place, data that is stale or not saved, failing deploy. Say which one it is, and on which side of the frame, before changing anything.
3. **Fix the cause where it lives** - a missing trusted site is a metadata change, not a guest workaround; a stale read gets the right cache policy, not a reload.
4. **Prove it** and leave a guard: a test, an X-ray rule that now passes, a preflight hint, a line in the troubleshooting docs.

## Review

Goal: a short, ranked list of what will break or expose first - each finding with file, line or setting, why, and the fix.

1. **Scope:** the surfaces the user names, the changed files (`git diff --name-only <base>...HEAD`) or the whole project.
2. **Run the tools:** the X-ray, the preflight against the target org, and each surface's own lint and tests.
3. **Read** the design and the code with the checklist in [references/review.md](references/review.md#review-checklist) - the tools find patterns, the checklist finds roles that overlap, data paths that fork and trust that nobody decided.
4. **Report** ranked by impact: trust and security, data integrity, broken composition, navigation and configuration, build and deploy, tests and accessibility, documentation. Mark which findings a tool reported and which are judgement. End with what is already good, so the team knows what not to touch.

## Alongside the other skills

This skill does its whole job on its own. When other skills from the same marketplace are installed, the work splits like this:

- **LWC Crafter** - owns Lightning web components in depth: tests, accessibility, styling, security. The host LWC follows its practices; this skill owns the embedding inside it.
- **E2E Automator** - UTAM UI tests in Lightning. A frame's content is a different origin; test the guest with its own Playwright suite and the host page with UTAM.
- **DevOps Builder** - the pipeline must install and build every UI bundle before it deploys, and run each bundle's checks in its own job. Name this when handing over.
- **DevOps Operator** - commits, pull requests, failed checks, promotions.
- **Demo Designer** - records the surfaces for a demo once they work.
- **`.github/salesforce-devops.yml`** - read it if it exists: `branches` names the work branch. Without it, ask.

Salesforce publishes generator skills for React UI bundles in [`forcedotcom/afv-library`](https://github.com/forcedotcom/afv-library) (`experience-react`), and agent skills (`agentforce-adlc`). They generate one React app, its data access, its deployment or an agent; this skill decides how surfaces and frameworks fit together, covers Angular, embedding and external guests, and reviews the whole. When both are installed, let a generator write a single React feature, and keep the architecture, the seams and the review here.

## Reference map

- [references/sources.md](references/sources.md) - where every fact lives: Polyglot Arcade and its docs, the Snake guest, Salesforce's guides and release notes, recipes, npm packages, CLI
- [references/architecture.md](references/architecture.md) - choosing a surface, one role per surface, integration patterns, configuration as data, navigation, communication, diagrams, decision records
- [references/ui-bundles.md](references/ui-bundles.md) - scaffolding, anatomy, runtime environment, data client, structure, dev loop, build and deploy, tests without an org
- [references/embedding.md](references/embedding.md) - internal and external guests, the host LWC, the View SDK, the package-free bridge, who saves, trust settings, local development, page fan-out
- [references/data-and-security.md](references/data-and-security.md) - the data model as contract, configuration records, access, seed data, trust boundaries
- [references/agentforce.md](references/agentforce.md) - the Conversation Client in a UI bundle, agents on the same data, agent output as UI, data for other AI clients
- [references/org-and-deploy.md](references/org-and-deploy.md) - requirements, preflight, scratch org definition, one-command setup, connect step, upgrades, release acceptance, pipelines
- [references/review.md](references/review.md) - X-ray rules, review checklist, diagnosing a broken surface
