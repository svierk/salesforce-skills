---
name: salesforce-hxl-hero
description: 'Builds, ships, tries and fixes Salesforce Headless Experience Layer (HXL) widgets the way Polyglot Arcade does - Apex invocable actions on the org''s data as tools of a custom Salesforce Hosted MCP server, their results mapped by custom Lightning types onto UI widgets that Claude, ChatGPT and Slackbot render natively, with OAuth sign-in through an External Client App and a setup that turns it all on. TRIGGER when: building or changing an HXL widget (UiWidgetBundle, tile/* components, widget schema.json); the custom Lightning types that map an action''s result onto a widget (LightningTypeBundle with renderer.json, outputValues); an Apex invocable action meant as an MCP tool; creating, configuring or activating a custom MCP server (McpServerDefinition, McpServerAccess) or the External Client App MCP clients sign in with; turning HXL on in an org or automating its setup; connecting Claude, ChatGPT or Slackbot to an org''s MCP server; a tool that does not show up, a sign-in that fails or lands in the wrong org, a widget that does not render or shows "Couldn''t render a rich UI"; reviewing an HXL project. DO NOT TRIGGER when: deciding whether an app needs a headless surface or an agent at all, or how it fits next to UI bundles and microfrontends - that is the Multi-Framework Wizard; authoring or testing an agent itself (Agent Script, topics, agent actions); a Lightning web component as renderer of an agent action - the LWC Crafter; Salesforce''s standard MCP servers without widgets; the CI/CD pipeline of a project with widgets - workflows, test jobs, where the settings deploy runs - that is the DevOps Builder; commits, pull requests and a failed check - the DevOps Operator.'
license: MIT
---

# Salesforce HXL Hero

Helps developers and architects bring an org's data into AI clients with the Salesforce **Headless Experience Layer** (HXL): an Apex invocable action becomes a tool of a custom MCP server hosted by Salesforce, and its result renders as a widget - declared once in JSON - in Claude, ChatGPT and Slackbot. The reference is [Polyglot Arcade](https://github.com/svierk/polyglot-arcade) v1.1.0, whose headless surface shows a Hall of Fame and a player card in Claude on the same records its Angular, React and Lightning surfaces use.

HXL projects rarely fail in the widget. They fail in the chain around it: a Lightning type whose fields do not match the action, a setting that comes too late in the deploy, an MCP server that was never activated, a permission set without the Apex class, an OAuth app the client cannot sign in with, a client that bundles two requests into one call. This skill walks that chain end to end and checks every link before calling it done.

## Pick the mode first

| Mode       | The user wants to...                                                                        | Go to             |
| ---------- | ------------------------------------------------------------------------------------------- | ----------------- |
| **Design** | decide what to show in which client, which tools and widgets, and whether HXL fits          | [Design](#design) |
| **Build**  | write the Apex tool, the Lightning types, the widget and the MCP server definition          | [Build](#build)   |
| **Ship**   | turn HXL on, deploy, sign-in, activate the server and connect a client - once or as a setup | [Ship](#ship)     |
| **Try**    | see a tool's result and its widget without the client, or prove a change end to end         | [Try](#try)       |
| **Fix**    | make a missing tool, a failing sign-in or a widget that does not render work again          | [Fix](#fix)       |
| **Review** | audit an HXL project before a release or a pull request                                     | [Review](#review) |

Infer the mode from the repository too: a project with `uiWidgets/` but no `mcpServerDefinitions/` gets Ship offered, a project with both gets Review offered - not forced, the user decides.

## Ground rules

1. **Fetch facts, don't recall them.** HXL is a beta and moves every release: the component palette, the metadata formats, the channels. Read them from their source at run time - the HXL guide, the org's `discoverUiComponents` and `getUiComponentSchemas` actions, the Actions REST describe ([references/sources.md](references/sources.md)) - and name the release a fact belongs to. Polyglot Arcade is a verified fixed point, not the current truth. Never write a component, attribute, formula function or metadata field you have not seen in the documentation, the org or the project in this session.
2. **Same data, same rules.** A tool reads the records the apps already use, as the user who asks: the Apex class `with sharing`, queries `WITH USER_MODE` or `AccessLevel.USER_MODE`, the MCP client signed in with that user's OAuth token. Apex is the right tool here - an MCP tool is an invocable action, which the UI API cannot provide - but keep it thin: query, shape, return. Read-only unless the user asks for a write, and then validate like any other input - [references/apex-tools.md](references/apex-tools.md).
3. **The describe is the source of truth.** The response type of a tool has exactly the outputs the Actions REST describe returns for its action - generate it from the describe after deploying the Apex, never from what you think the class returns - [references/lightning-types.md](references/lightning-types.md).
4. **One request, one widget.** A widget renders one result. The tool's input is a list (`inputs: [ ... ]`, the shape of an invocable action), and clients use it to bundle requests - which renders as text only. Say in every tool description that it takes exactly one request per call - [references/mcp-server.md](references/mcp-server.md#tool-descriptions).
5. **Verify in the org, then write it down.** HXL behaviour that a design relies on - a setting, an activation, a URL, a scope name - is checked in a scratch org first. What the official documentation leaves out is in [references/verified.md](references/verified.md); add what you verify to the project's own docs.
6. **Never touch production, never move the user's defaults.** Deploy, set up and activate only in scratch orgs, sandboxes and developer orgs - check the org first (orientation below). Production gets HXL through the team's pipeline. Name `--target-org <alias>` on every command instead of changing the default org.
7. **Show before changing org-wide settings.** Turning on the HXL beta (it accepts beta terms for the org), creating an External Client App, activating an MCP server (it opens the org to MCP clients) and changing permission sets affect every user. Show the exact change and its trade-off, and wait for a yes.
8. **Tokens stay out of the conversation.** Access tokens, refresh tokens and session URLs stay in memory or in a file outside the repository with owner-only rights; never print them, never commit them. The OAuth client ID of an External Client App is public and may be shown. Passwords only when the user asks for one, for their own scratch org.
9. **Green before done.** A change is done when the checker of this skill passes, the Apex tests pass, the tool returns the expected result through the MCP server and its widget renders - and the user has seen it in the real client. Say what ran and what it found; never report a check you did not run.

## Orientation

Once per session, from the project root - the Salesforce DX project the user works in, never this skill's folder:

```bash
git status --short --branch
cat sfdx-project.json
ls force-app/main/default/{uiWidgets,lightningTypes,mcpServerDefinitions,externalClientApps,classes} 2>/dev/null
node <skill dir>/scripts/hxl-check.mjs
```

The checker maps the project - tools, widgets, Lightning types, MCP servers, sign-in - and reports what breaks between them ([Checking the chain](#checking-the-chain)). Take the project's conventions from what is there and follow them over this skill's defaults. Before the first deployment, check the org - read-only:

```bash
node <skill dir>/scripts/preflight.mjs --target-org <alias>
```

It reports the org type, the API version, whether the org has the HXL setting and whether it is on, and whether it knows MCP server definitions, widgets and External Client Apps. A production org: stop and ask for another one.

## Checking the chain

The skill ships a checker for what has one right answer between the pieces - widget bindings without an attribute, a renderer that misses a widget attribute or binds outside `outputValues`, a response type that does not match the Apex outputs, a tool whose widget resource does not exist, a tool class no permission set grants, an External Client App without the MCP scope, a tool description that invites bundled calls and more:

```bash
node <skill dir>/scripts/hxl-check.mjs [project root] [--errors-only] [--json]
```

Errors break a tool or its widget, warnings are worth a look in every review, infos are hints; the exit code is 1 when there is an error. The rules are in [references/review.md](references/review.md#checker-rules). A finding the team decided to keep is suppressed with a reason: `hxl-ignore <rule> -- <reason>` in a comment of the XML or Apex file, or `<rule> <path> -- <reason>` in `.hxl-check-ignore` for JSON files.

## Design

Goal: tools and widgets the user agrees on before code - what each one answers, for whom, in which client, on which data.

1. **The questions.** Collect the questions people will ask - "who is this week's champion?", "how am I doing?" - and who asks them. One tool per kind of question, not per object; a tool that answers everything answers nothing well.
2. **Fit.** HXL fits answers that are worth seeing - a ranking, a card, a short list with actions - in a client the users already have open. It does not fit input forms (widgets have no input fields), real-time interaction or anything that must write without a human in the loop - [references/design.md](references/design.md#when-hxl-fits).
3. **Channel.** Claude, ChatGPT and Slackbot through a custom MCP server, or an Agentforce employee agent in Lightning. They share the widget but not the wiring - check the channel's status for the org's release, and start with one - [references/design.md](references/design.md#channels).
4. **Per tool:** the inputs (few, forgiving: a name or a key, a period), the outputs (what the widget shows plus flags that drive it, such as `hasEntries`), empty and error states as messages, and the buttons that lead to the next question or back to an app.
5. **Per widget:** a sketch from the palette the org offers (`discoverUiComponents`), one `h1`, at most one primary button, and the domain's vocabulary - a leaderboard row looks like the apps' leaderboard rows.
6. **Where it fits in the architecture:** next to UI bundles and microfrontends, the headless surface is a surface of its own with one role. With the Multi-Framework Wizard installed, hand the architecture question to it; otherwise write a short decision record - Polyglot Arcade's ADR 0003 is a template.

## Build

Goal: a tool that returns the right data as the asking user, and a widget that shows it - verified against the org, not only on disk. Work in this order; every step depends on the one before.

1. **The Apex tool.** A `global with sharing` class with one `@InvocableMethod`, a `Request` and a `Response` class with `@InvocableVariable` fields, and lists of rows as global inner classes with `@AuraEnabled` fields. Descriptions on the method and every variable - they become the tool's documentation for the model. Tests with more than one user, ties, empty and unknown inputs - [references/apex-tools.md](references/apex-tools.md).
2. **Deploy the class and read the describe:** `sf api request rest /services/data/v<api>/actions/custom/apex/<Class> -o <alias>`. The `outputs` decide the response type - [references/lightning-types.md](references/lightning-types.md#from-the-describe).
3. **Two Lightning types per tool:** the response type (one property per output; lists and objects as `@apexClassType/c__<Class>$<Inner>`) and the envelope type (`actionName`, `isSuccess`, `outputValues` typed `c__<response type>`), both object-based with `"lightning:tags": ["mcp"]` and `"unevaluatedProperties": false` - [references/lightning-types.md](references/lightning-types.md).
4. **The widget:** `<name>.json` with a `tile/widget` root, `schema.json` with one attribute per output (lists as `lightning__listType` with `items`), `<name>.uiwidget-meta.xml`. Check the components against the org's palette and schemas first - [references/widgets.md](references/widgets.md).
5. **The renderer** in the envelope type: `@widget/c/<widget>` and one binding per widget attribute, `{!$attrs.outputValues.<output>}` - [references/lightning-types.md](references/lightning-types.md#the-renderer).
6. **The MCP server definition:** one tool per action with title, a description that asks for one request per call, `readOnly`/`idempotent` hints, `uiResource` naming a resource whose URI is `ui://widget/lightningType/c__<envelope type>` - [references/mcp-server.md](references/mcp-server.md).
7. **Access:** the permission set of the users grants the tool classes (`classAccesses`) - without it the server lists no tools for them.
8. **Check and deploy:** run the checker, deploy widgets and types in one deploy (the Metadata API orders them), then the server definition, then Try.

Salesforce's skills `platform-mcp-tool-widget-coordinate`, `platform-widget-generate` and `platform-custom-lightning-type-generate` generate single pieces of this chain; see [Alongside the other skills](#alongside-the-other-skills).

## Ship

Goal: the chain running in an org and a client connected - by hand once, and as a setup that is safe to run again.

1. **Preflight** the org (orientation). A production org: stop.
2. **Turn HXL on before the deploy** that contains widgets - `Settings:UiWidget` with `hxlEnabled`, deployed on its own. In the same deploy as the widgets it comes too late. In scratch orgs, `settings.uiWidgetSettings.hxlEnabled` in the definition does the same. Rule 7: this accepts the beta terms for the org - [references/setup.md](references/setup.md#turn-hxl-on).
3. **Deploy** the Apex, the widgets and types, the server definition and the permission set; assign the permission set.
4. **Sign-in:** an External Client App with the OAuth scopes `MCP` and `RefreshToken`, PKCE, JWT-based tokens for named users, no client secret, and the client's callback URL. It deploys as metadata - also into scratch orgs, where Setup cannot create one. Rule 7 - [references/auth-and-clients.md](references/auth-and-clients.md#the-external-client-app).
5. **Activate the server** - an `McpServerAccess` record, which the server definition has no field for - after a yes (rule 7):

   ```bash
   node <skill dir>/scripts/mcp-connect.mjs --target-org <alias> --server <name> --oauth-settings <eca>_glbloauth [--activate]
   ```

   Without `--activate` it only reports. It prints the server URL - with `/sandbox/` for sandboxes and scratch orgs - and the OAuth client ID.

6. **Connect the client** with the URL and client ID, sign in as a user with the permission set, ask a question that needs the tool - [references/auth-and-clients.md](references/auth-and-clients.md#clients). Warn about the waits: a new External Client App can take up to 30 minutes, a changed tool description about two minutes, a changed widget until the client reloads it.
7. **One command for the team:** fold steps 2 to 5 into the project's setup script - the settings deploy before the main deploy, activation and the printout in its connect step, an HXL check in its preflight - [references/setup.md](references/setup.md#a-setup-that-is-safe-to-run-again). Document Connect Claude, the waits and the troubleshooting in the project's docs.

## Try

Goal: the tool's result and its widget seen before anyone opens a client - and the proof that a change works end to end.

1. **Through the org:** call the action directly - `sf api request rest /services/data/v<api>/actions/custom/apex/<Class> --method POST --body '{"inputs":[{...}]}' -o <alias>` - and compare `outputValues` with what the widget expects.
2. **Through the MCP server:** sign in like a client and call `tools/list`, `resources/read` and `tools/call` - [references/testing.md](references/testing.md#through-the-mcp-server):

   ```bash
   node mcp-try.mjs login  --target-org <alias> --client-id <client id>
   node mcp-try.mjs tools  --server-url <url>
   node mcp-try.mjs call   --server-url <url> --tool <tool> --args '{"inputs":[{...}]}'
   node mcp-try.mjs render --server-url <url> --tool <tool> --args '{"inputs":[{...}]}' --out widget.png [--theme dark]
   ```

   `render` loads the tool's widget resource - the same renderer the client embeds - into a minimal MCP Apps host and takes a screenshot. It runs from a workspace outside the repository with `playwright-core` and the installed Google Chrome - [references/testing.md](references/testing.md#workspace).

3. **As a user without admin rights:** sign in once as a user with only the permission set. Tools that an admin sees and a user does not are the most common gap.
4. **In the client:** the user connects and asks; screenshots from there go into the project's docs.

## Fix

Goal: the cause named and fixed in the right link of the chain, with the check that would have caught it.

1. **Locate the link:** deploy, setting, permission, sign-in, server, tool call, renderer, widget or client. Collect what each side says - the deploy output, the describe, `mcp-try` output, the client's message and its request/response view.
2. **Classify** with the symptom table in [references/troubleshooting.md](references/troubleshooting.md) and say which link it is before changing anything.
3. **Fix the cause where it lives** - a missing class access is a permission set change, not an admin login; a bundled call is a tool description, not a widget workaround.
4. **Prove it** with Try, and leave a guard: a test, a checker rule that now passes, a preflight hint, a troubleshooting line in the project's docs.

## Review

Goal: a short, ranked list of what will break or expose first - each finding with file or setting, why, and the fix.

1. **Run the tools:** the checker, the preflight against the target org, the Apex tests.
2. **Read** the chain with the checklist in [references/review.md](references/review.md#review-checklist): what each tool may read and for whom, what the descriptions tell the model, empty and error states, what an org-wide setting opened.
3. **Report** ranked by impact: data exposure and access, broken chain, sign-in and activation, rendering, documentation. Mark which findings a tool reported and which are judgement. End with what is already good.

## Alongside the other skills

This skill does its whole job on its own. When other skills from the same marketplace are installed, the work splits like this:

- **Multi-Framework Wizard** - owns the architecture: which surface does what, the data contract, roles and decision records. It decides that a headless surface belongs in the design; this skill builds, ships and fixes it on the same data contract.
- **LWC Crafter** - a Lightning web component as renderer of an agent action, and any LWC around the apps.
- **DevOps Builder** - the pipeline must deploy `Settings:UiWidget` before the widgets and run the Apex tests; name both when handing over. **DevOps Operator** - commits, pull requests, failed checks.
- **Demo Designer** - records the widgets in the client once they work.
- **`.github/salesforce-devops.yml`** - read it if it exists: `branches` names the work branch.

Salesforce publishes generator skills for single pieces of the chain in [`forcedotcom/sf-skills`](https://github.com/forcedotcom/sf-skills): `platform-mcp-tool-widget-coordinate` (types and widget for an MCP tool), `platform-widget-generate`, `platform-custom-lightning-type-generate` and `platform-lightning-type-widget-coordinate` (the Agentforce channel). When they are installed, let them write a single widget or type; keep the chain - setting, sign-in, activation, access, client - and the checks here.

## Reference map

- [references/sources.md](references/sources.md) - where every fact lives: Polyglot Arcade's headless surface, the HXL and Hosted MCP guides, the org's own actions, Salesforce's skills
- [references/design.md](references/design.md) - when HXL fits, channels, tools and widgets from questions
- [references/apex-tools.md](references/apex-tools.md) - the invocable action as a tool: shape, security, descriptions, tests
- [references/lightning-types.md](references/lightning-types.md) - response and envelope types from the describe, the renderer
- [references/widgets.md](references/widgets.md) - composition, palette, bindings, loops, conditions, formulas, actions, styling
- [references/mcp-server.md](references/mcp-server.md) - the server definition, tool descriptions, resources, activation, URLs
- [references/auth-and-clients.md](references/auth-and-clients.md) - the External Client App, OAuth, connecting Claude, ChatGPT and Slackbot
- [references/setup.md](references/setup.md) - turning HXL on, deploy order, a setup that is safe to run again, preflight, CI
- [references/testing.md](references/testing.md) - Apex tests, the describe, the MCP server from a script, rendering a widget without the client
- [references/troubleshooting.md](references/troubleshooting.md) - symptoms, causes and fixes along the chain
- [references/verified.md](references/verified.md) - what was verified in a real org and is missing from the official documentation
- [references/review.md](references/review.md) - checker rules and the review checklist
