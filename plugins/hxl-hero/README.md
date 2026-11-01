# 🦸 HXL Hero

Build, ship, try and fix Salesforce **Headless Experience Layer** (HXL) widgets - built around [Polyglot Arcade](https://github.com/svierk/polyglot-arcade)'s headless surface: a Hall of Fame and a player card that Claude renders natively, served by a custom Salesforce Hosted MCP server on the same records as the arcade's Angular, React and Lightning surfaces.

For developers and architects who want an org's data in the AI clients people already use. HXL experiences rarely fail in the widget - they fail in the chain around it: a Lightning type whose fields do not match the action, a setting that comes too late in the deploy, an MCP server nobody activated, a permission set without the Apex class, an OAuth app the client cannot sign in with, a client that bundles two requests into one call. The skill walks that chain end to end and checks every link before calling it done.

## What it does

| Mode       | Example requests                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Design** | "Which questions should our sales leaderboard answer in Claude?" · "HXL widget or Agentforce action?"                                            |
| **Build**  | "Turn this Apex class into an MCP tool with a widget" · "Add a player card widget" · "Generate the Lightning types from the action"              |
| **Ship**   | "Turn on HXL and activate the MCP server in my scratch org" · "Fold the MCP setup into our setup script" · "Connect Claude to the org"           |
| **Try**    | "Show me the widget without opening Claude" · "Call the tool as a user without admin rights"                                                     |
| **Fix**    | "Claude says Couldn't render a rich UI" · "The connector shows no tools" · "Sign-in lands in the wrong org" · "Deploy: not available for deploy" |
| **Review** | "Review our HXL project before the release" · "What can this tool read, and for whom?"                                                           |

- **Design** collects the questions people ask, cuts one tool per kind of question with few, forgiving inputs, and sketches the widget from the palette the org offers.
- **Build** goes in the order the platform needs: the Apex invocable action, its describe, the response and envelope Lightning types generated from it, the widget, the renderer, the MCP server definition and the permission set.
- **Ship** turns HXL on before the deploy that needs it, deploys the External Client App clients sign in with, activates the server, prints the URL and client ID - and folds it all into a setup that is safe to run again.
- **Try** signs in like a client, lists and calls the tools and renders a widget with Salesforce's own renderer - without the client.
- **Fix** names the link of the chain before changing anything.
- **Review** runs the checker and the preflight and reads what each tool may show to whom.

## Practices it applies

Drawn from Polyglot Arcade v1.1.0, Salesforce's HXL and Hosted MCP guides, and what was verified in a real org:

- **Same data, same rules** - a tool reads the records the apps use, as the user who asks: `with sharing`, user mode, OAuth per user, read-only by default.
- **The describe is the source of truth** - the response type has exactly the action's outputs, generated from the org, not from memory.
- **One request, one widget** - every tool description asks for one request per call, because a bundled call renders as text only.
- **Org-wide changes are shown first** - turning on the beta, the External Client App, activating the server, permission sets.
- **Facts from the source** - HXL is a beta; the skill reads the palette, the formats and the status from the org and the guides at run time, and keeps a list of what was verified beyond the documentation.

## The checker

The skill's checker maps every tool - server, Apex class, envelope type, response type, widget - and checks 32 rules between them:

```bash
node scripts/hxl-check.mjs                 # map and findings of the project
node scripts/hxl-check.mjs --json
```

It reports widget bindings without an attribute, renderers that miss a widget attribute or bind outside `outputValues`, response types that do not match the Apex outputs, tools whose widget resource does not exist, tool classes no permission set grants, Apex without sharing or user mode, External Client Apps without the MCP scope or PKCE, tool descriptions that invite bundled calls and more. A finding the team decided to keep is suppressed with a reason.

The preflight checks an org read-only - org type, API version, the HXL setting and whether it is on, widgets, MCP server definitions, External Client Apps:

```bash
node scripts/preflight.mjs --target-org <alias>
```

`mcp-connect.mjs` reports or activates an MCP server and prints its URL and OAuth client ID; `mcp-try.mjs` signs in like a client, calls tools and renders their widgets from a workspace with `playwright-core`.

## Guardrails

- Setups and activations run in scratch orgs, sandboxes and developer orgs only - the preflight names a production org, and the skill stops there.
- Turning on the HXL beta, creating an External Client App, activating an MCP server and changing permission sets are shown with their effect and done only after you say yes.
- The default org is never changed; every command names its target org.
- Access tokens and session URLs are never printed or committed; the token file of `mcp-try.mjs` is owner-only and lives outside the repository.

## Alongside other skills

- [🧙 Multi-Framework Wizard](../multi-framework-wizard) owns the architecture - which surface does what, the data contract, decision records. It decides that a headless surface belongs in the design; the HXL Hero builds, ships and fixes it on the same data.
- [⚡ LWC Crafter](../lwc-crafter) builds a Lightning web component when an agent action needs one as renderer.
- [🏗️ DevOps Builder](../devops-builder) builds the pipeline - which must deploy the HXL setting before the widgets and run the Apex tests; [🧭 DevOps Operator](../devops-operator) takes over for commits and pull requests.
- [🎬 Demo Designer](../demo-designer) records the widgets in the client once they work.
- Salesforce publishes generator skills for single pieces of the chain in [`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills) - `platform-mcp-tool-widget-coordinate`, `platform-widget-generate`, `platform-custom-lightning-type-generate`. They write one widget or type; the HXL Hero keeps the chain around them - the setting, sign-in, activation, access, the client - and the checks.

## Requirements

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with a scratch org, sandbox or developer org on a release with HXL and Salesforce Hosted MCP servers (Winter '27 or later)
- Node.js for the scripts; for `mcp-try.mjs` a workspace with `playwright-core` and Google Chrome
- An MCP client that renders MCP Apps - Claude or ChatGPT - for the final check

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install hxl-hero@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install hxl-hero@salesforce-skills`.
