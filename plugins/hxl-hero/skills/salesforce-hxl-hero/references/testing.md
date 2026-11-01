# Testing

Every link of the chain can be checked before anyone opens a client - and should be, because a client shows only the end result. From cheap to complete:

| Level      | Checks                                                      | Tool                                              |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Project    | The files agree with each other                             | `scripts/hxl-check.mjs`                           |
| Apex       | The tool's logic, as several users                          | Apex tests ([apex-tools.md](apex-tools.md#tests)) |
| Org        | The action's outputs and a real result                      | Actions REST describe and invoke                  |
| MCP server | Sign-in, tools a user sees, the resource, a call            | `mcp-try.mjs login`, `tools`, `call`              |
| Widget     | The renderer with real data, light and dark, empty and full | `mcp-try.mjs render`                              |
| Client     | The real thing                                              | The user, in Claude, ChatGPT or Slack             |

## Through the org

```bash
# outputs - the contract of the response type
sf api request rest '/services/data/v<api>/actions/custom/apex/<Class>' -o <alias>
# a real result
sf api request rest '/services/data/v<api>/actions/custom/apex/<Class>' --method POST \
  --body '{"inputs":[{"game":"Brick Breaker","period":"week"}]}' -o <alias>
```

Test data from more than one user makes rankings meaningful. In a scratch org: create users with `sf org create user` (a Developer Edition scratch org has two Salesforce licences - use a platform profile for more), assign the permission set, and insert their records with anonymous Apex run as each of them (`sf apex run -o <user alias>`), so `CreatedById` differs.

## Workspace

`mcp-try.mjs` drives the installed Google Chrome through `playwright-core` - for the sign-in and for rendering. Like the Demo Designer, it runs from a folder outside the user's repository:

```bash
mkdir -p <workspace> && cd <workspace>
npm init -y && npm pkg set type=module
npm install playwright-core
cp <skill dir>/scripts/mcp-try.mjs .
```

Without Google Chrome, `npx playwright install chrome` installs it - ask first, it is a system change. The token file lives in the workspace with owner-only rights; delete the workspace when done.

## Through the MCP server

```bash
node mcp-try.mjs login --target-org <alias> --client-id <client id> [--callback <client callback url>]
```

Signs in like a client: opens the org's frontdoor in-process (the URL from `sf org open --url-only` is never printed), runs the PKCE authorization-code flow against the External Client App, intercepts the redirect to the client's callback, exchanges the code and writes the token to `.mcp-token.json` (mode 600). The callback defaults to Claude's; it must be one of the External Client App's callback URLs. A new user may hit "Change Your Password" first - set one with `sf org generate password` for that user.

To sign in as another user - always try one with only the permission set - pass that user's alias.

```bash
node mcp-try.mjs tools --server-url <url>
node mcp-try.mjs call  --server-url <url> --tool <tool> --args '{"inputs":[{...}]}'
```

`tools` lists the tools the signed-in user sees with their widget resource; `call` prints the result's `structuredContent`. A missing tool for a user who should see it: the permission set lacks the class.

## Rendering a widget

```bash
node mcp-try.mjs render --server-url <url> --tool <tool> --args '{"inputs":[{...}]}' --out widget.png [--theme dark]
```

Calls the tool, reads its `ui://` resource - Salesforce's widget renderer, the same the client embeds - loads it into a minimal MCP Apps host and takes a screenshot of the frame. The host answers `ui/initialize` with the theme, then sends the tool input and the tool result, and sizes the frame as the app asks. The events it saw are printed; a frame that never reports a size did not render.

Render every widget with real data and in the empty state, light and dark - and once with a bundled call (two entries in `inputs`) to see the text-only fallback. The screenshot shows the widget as the renderer draws it; in the client it takes the client's theme. Say so when using such a screenshot in documentation.

## In the client

The user connects and asks; their screenshot is the final proof. Ask for the client's request and response view (Claude: the `</>` icon on the tool block) when something looks wrong - it shows the arguments the model sent.
