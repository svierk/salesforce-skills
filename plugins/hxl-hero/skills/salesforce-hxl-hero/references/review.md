# Review

What the checker of this skill reports, and what a person still has to read.

## Checker rules

`node <skill dir>/scripts/hxl-check.mjs [path] [--errors-only] [--json]` maps every tool - server, Apex class, envelope type, response type, widget - and checks the links between them.

| Rule                    | Severity        | Reports                                                                                                                        |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `widget-files`          | error           | A widget bundle without its composition, `schema.json` or `.uiwidget-meta.xml`                                                 |
| `widget-root`           | error           | A composition that is not `lightning__agentforceWidget` with a `tile/widget` root                                              |
| `widget-binding`        | error           | `$attrs.<name>` in the composition that is not an attribute in `schema.json`                                                   |
| `widget-list-items`     | error           | A `lightning__listType` attribute without `items.lightning:type`                                                               |
| `widget-if-boolean`     | warning         | `meta.if` bound to an attribute that is not a boolean                                                                          |
| `widget-button-action`  | warning         | A `tile/button` without `action/openLink` or `action/sendMessage` - it renders disabled                                        |
| `type-schema`           | error           | A Lightning type without a readable `schema.json`                                                                              |
| `type-list`             | error           | A list typed `lightning__listType` or with `items` in a Lightning type                                                         |
| `type-apex-ref`         | error / warning | `@apexClassType/c__<Class>$<Inner>` whose inner class does not exist (error) or whose class is not in the project (warning)    |
| `type-envelope-ref`     | error           | An envelope whose `outputValues` does not reference an existing response type as `c__<name>`                                   |
| `type-response-outputs` | error           | A response type not 1:1 with the `@InvocableVariable` fields of the action's response class                                    |
| `type-mcp-tag`          | warning         | An envelope or response type without `"lightning:tags": ["mcp"]`                                                               |
| `type-unevaluated`      | warning         | An object-based type without `"unevaluatedProperties": false`                                                                  |
| `renderer-widget`       | error           | A renderer whose `@widget/c/<name>` is not in the project, or unreadable                                                       |
| `renderer-outputvalues` | error           | An envelope's renderer binding outside `{!$attrs.outputValues.*}`                                                              |
| `renderer-binding`      | error / warning | A binding to a widget attribute or response output that does not exist (error), a widget attribute without a binding (warning) |
| `renderer-location`     | warning         | A widget renderer in the response type instead of the envelope type                                                            |
| `mcp-ui-resource`       | error           | A tool whose `uiResource` matches no `resourceName`                                                                            |
| `mcp-resource-uri`      | error           | A resource URI that is not `ui://widget/lightningType/c__<envelope>` of an existing type with a renderer                       |
| `mcp-one-request`       | warning         | A tool description that does not ask for exactly one request per call                                                          |
| `mcp-tool-class`        | warning / info  | A tool whose Apex class is not in the project, or that is not an Apex action                                                   |
| `mcp-hints`             | info            | A tool without a `readOnly` hint                                                                                               |
| `apex-sharing`          | warning         | A tool class that is not `with sharing`                                                                                        |
| `apex-user-mode`        | warning         | A tool class that queries without `USER_MODE` (or `SECURITY_ENFORCED`)                                                         |
| `access-class`          | warning         | A tool class that no permission set grants                                                                                     |
| `hxl-setting`           | info            | Widgets without `Settings:UiWidget` or a scratch definition that turns HXL on                                                  |
| `eca-contact`           | error           | An External Client App without `contactEmail`                                                                                  |
| `eca-scope`             | error / warning | OAuth scopes without `MCP` (error) or `RefreshToken` (warning) in a project with MCP servers                                   |
| `eca-pkce`              | warning         | Global OAuth settings without `isPkceRequired`                                                                                 |
| `eca-callback`          | warning         | Global OAuth settings without a callback URL                                                                                   |
| `eca-consumer-key`      | warning         | A committed `consumerKey` - it is generated per org                                                                            |
| `eca-missing`           | info            | MCP servers without an External Client App in the project                                                                      |

A finding the team decided to keep is suppressed with a reason - the reason is required:

- in an XML or Apex file: `<!-- hxl-ignore <rule> -- <reason> -->` or `// hxl-ignore <rule> -- <reason>` anywhere in the file;
- for JSON files, which have no comments: a line `<rule> <path relative to the root> -- <reason>` in `.hxl-check-ignore` at the project root (a folder path covers the files below it).

## Review checklist

The checker finds broken links. A person reads for what a link should not do:

**Data and access**

- What can each tool read, and for whom? Run it as a user with only the permission set and compare with what the apps show that user.
- Does any tool return more fields than its widget shows? The model reads all of `structuredContent`.
- Does a tool write? Then it validates every input, says so in its description, and its hints are `readOnly` false and `destructive` true where it deletes.
- Who can sign in through the External Client App - all users, or a permission set (pre-authorization)? Refresh token validity, IP ranges, single logout for anything beyond a demo.

**The chain**

- Response types generated from the describe of the deployed class, not written by hand.
- The settings deploy before the widgets in the setup and in the pipeline.
- Activation and the printout of URL and client ID in the setup, idempotent.

**What the model sees**

- Tool descriptions: what it answers, valid input values, examples, one request per call.
- Empty, unknown and error cases return a message the model can pass on.
- Button messages (`sendMessage`) phrased as the user would ask, naming the product, so they reach the right tool.

**Rendering**

- Every widget rendered with real data and empty, light and dark (`mcp-try.mjs render`).
- One `h1`, one primary button, semantic variants only, the domain's vocabulary.

**Documentation**

- Connect Claude (or the client the team uses), the waits, the troubleshooting lines, a decision record - and screenshots from the real client, marked when they come from the renderer alone.

Report ranked by impact - data exposure and access, broken chain, sign-in and activation, rendering, documentation - mark what a tool reported and what is judgement, and end with what is already good.
