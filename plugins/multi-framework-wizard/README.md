# 🧙 Multi-Framework Wizard

Design, build, embed, review and fix Salesforce Multi-Framework applications - built around [Polyglot Arcade](https://github.com/svierk/polyglot-arcade): an Angular hub, a React cabinet and an LWC OSS game that share one org's data and meet on Lightning pages as microfrontends, documented with integration patterns and architecture decision records.

For architects, tech leads and developers who bring React, Angular or an existing web app onto the Salesforce Platform. Multi-framework apps rarely fail inside one framework - they fail between them: two apps that both claim to be the start, a frame that stays blank because a trusted site is missing, a link that opens an empty Lightning app, a guest whose data nobody validates, a URL that only works in one org. The skill puts those seams first - roles, the data contract, the channels, the trust boundaries - so every framework can do what it is good at.

## What it does

| Mode           | Example requests                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design**     | "We have an Angular team and a React portal - how do they fit with our Lightning record pages?" · "LWC or React for the new planning tool?"                             |
| **Build**      | "Scaffold an Angular UI bundle for our order cockpit and connect it to the Opportunity data" · "Link the React app back to the Lightning app"                           |
| **Embed**      | "Show our React app on the Account page" · "Embed our Vue dashboard hosted on Azure in Lightning" · "Pass the record id into the frame"                                 |
| **Agentforce** | "Add the Agentforce chat to our React app" · "Let an agent answer who closed the most deals this week from the same data" · "Should our leaderboard show up in Claude?" |
| **Fix**        | "The embedded app stays blank" · "HEARTBEAT_TIMEOUT on the record page" · "The UI bundle does not open from the App Launcher" · "Deploy fails"                          |
| **Review**     | "Review our multi-framework architecture before go-live" · "Is this embedding secure?" · "What breaks when we upgrade to the next release?"                             |

- **Design** chooses a surface per job - LWC, a React or Angular UI bundle, an external app, an agent - gives every surface one role, picks one of Polyglot Arcade's four integration patterns per frame, and writes the result down as Mermaid diagrams and decision records.
- **Build** scaffolds bundles from Salesforce's templates and wires what the templates leave open: the App Launcher app and permission set, one data client over the Data SDK, framework-free logic, links between the surfaces, and a setup that is safe to run again.
- **Embed** writes the host LWC and the guest side - the View SDK, or the package-free bridge for LWR and other stacks - with a documented contract, a clear writer for the data, and the trusted sites shown before they are deployed.
- **Agentforce** places the agent where it helps - the Conversation Client in a UI bundle, an agent on the same records, agent output as UI, a headless surface in AI clients - on the same data path as the apps.
- **Fix** names the class of problem and the side of the frame before changing anything.
- **Review** runs the X-ray and the preflight and reads the design against a ranked checklist.

## Practices it applies

Drawn from Polyglot Arcade, Salesforce's Multi-Framework and UI Embedding guides, and what was verified in a real org:

- **One role per surface** - one entry point, machines that do one thing, Lightning as the floor where microfrontends are composed.
- **Each framework where it fits** - never to show it off; team skills count.
- **The data is the contract** - every surface reads and writes the same records through the UI API, under the user's sharing and field-level security; where an app lives is configuration on a record.
- **Every frame has a pattern and a writer** - the guest with the user's session, or the host after validating what the guest reports.
- **Explicit trust** - one origin per message, frame-src-only trusted sites, no session for external guests, no org-specific URL in code.
- **Facts from the source** - Multi-Framework changes every release; the skill reads status, SDK exports and requirements at run time and says which release a fact belongs to.

## The X-ray

Named after Polyglot Arcade's Tech X-ray, the skill's checker maps a project and checks the seams between its surfaces - 22 rules over UI bundle code, LWC hosts, seed data, apps, permission sets and trusted sites:

```bash
node scripts/xray.mjs                     # map and findings of the project
node scripts/xray.mjs --mermaid           # the map as a diagram
node scripts/xray.mjs --json
```

It lists every UI bundle with its framework and app, the host LWCs with their frames, events and message channels, the trusted sites and the integration patterns in use - and reports org-relative links that cannot launch a bundle, hard-coded `*.salesforce.app` URLs, frames that cannot remount or hide their errors, messages to any origin, wildcard trusted sites, the SDK in an LWR app and more. A finding the team decided to keep is suppressed with a reason: `// xray-ignore <rule> -- <reason>`.

The preflight checks an org before anything is deployed - org type, API version, the `UIBundle` metadata type, Hyperforce, default language and the Edge Network - read-only, with a hint for every gap:

```bash
node scripts/preflight.mjs --target-org <alias> [--min-api <version>]
```

## Guardrails

- Deployments and setups run in scratch orgs, sandboxes and developer orgs only - the preflight names a production org, and the skill stops there.
- Org-wide settings - trusted sites, trusted domains for inline frames, My Domain settings like the Edge Network or the first-party cookie requirement, session settings, permission sets - are shown with their trade-off and changed only after you say yes.
- The default org is never changed; every command names its target org.
- No session, token or frontdoor URL is handed to an externally hosted app.

## Alongside other skills

- [⚡ LWC Crafter](../lwc-crafter) owns Lightning web components in depth; the host LWC follows its practices, the embedding inside it is the wizard's.
- [🏗️ DevOps Builder](../devops-builder) builds the pipeline - which must build every UI bundle before it deploys; [🧭 DevOps Operator](../devops-operator) takes over for commits and pull requests.
- [🧪 E2E Automator](../e2e-automator) tests the Lightning pages; each bundle keeps its own Playwright suite.
- [🎬 Demo Designer](../demo-designer) records the surfaces once they work.
- [🦸 HXL Hero](../hxl-hero) builds, ships, tries and fixes a headless surface - HXL widgets that Claude, ChatGPT and Slackbot render from the same data; the wizard decides where it fits.
- Salesforce publishes generator skills for React UI bundles and for agents in [`forcedotcom/afv-library`](https://github.com/forcedotcom/afv-library). They generate one app, feature or agent; the wizard decides how surfaces and frameworks fit together, covers Angular, embedding and external guests, and reviews the whole.

## Requirements

- Node.js and npm in the versions the project's and each bundle's `package.json` ask for
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with a scratch org, sandbox or developer org on a release with Salesforce Multi-Framework
- [GitHub CLI](https://cli.github.com/) (`gh`) for reading Polyglot Arcade - optional, the skill falls back to the raw files and the documentation site

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install multi-framework-wizard@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install multi-framework-wizard@salesforce-skills`.
