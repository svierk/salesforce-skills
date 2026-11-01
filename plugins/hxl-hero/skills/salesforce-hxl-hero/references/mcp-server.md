# MCP server

A custom Salesforce Hosted MCP server offers the org's invocable actions as tools and links each tool to its widget. It is `McpServerDefinition` metadata in `mcpServerDefinitions/<name>.mcpServerDefinition-meta.xml`; Salesforce hosts it at `api.salesforce.com`.

## The definition

Setup can create a server, but it cannot add widget resources - write the file instead and deploy it:

```xml
<McpServerDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Polyglot Arcade</masterLabel>
    <description>Hall of Fame and player cards of the Polyglot Arcade, rendered as HXL widgets.</description>
    <tools>
        <toolName>getHallOfFame</toolName>
        <toolTitle>Get Arcade Hall of Fame</toolTitle>
        <descriptionOverride>Ranks the players of a Polyglot Arcade game by their best round, or names the champion of every game when no game is given. Optional period: today, week, month or all. Use it for questions like "Who is this week's champion?". Send exactly one object in inputs: the result renders as a widget only for a single request. To compare periods or games, call the tool once for each.</descriptionOverride>
        <readOnly>true</readOnly>
        <destructive>false</destructive>
        <idempotent>true</idempotent>
        <openWorld>false</openWorld>
        <returnDirect>false</returnDirect>
        <uiResource>hallOfFame</uiResource>
        <apiDefinition>
            <apiSource>API_CATALOG</apiSource>
            <apiIdentifier>aa:apex-ArcadeHallOfFame</apiIdentifier>
            <operation>ArcadeHallOfFame</operation>
        </apiDefinition>
    </tools>
    <resources>
        <resourceName>hallOfFame</resourceName>
        <resourceUri>ui://widget/lightningType/c__arcadeHallOfFame</resourceUri>
        <resourceTitle>Arcade Hall of Fame</resourceTitle>
        <description>Renders the getHallOfFame result with the arcadeHallOfFameWidget HXL widget.</description>
    </resources>
</McpServerDefinition>
```

- **`uiResource`** equals the `resourceName` of a `resources` entry - exactly, or the widget does not render.
- **`resourceUri`** is `ui://widget/lightningType/c__<envelope type>` - the type with the renderer, not the response type and not the widget.
- **`apiIdentifier`** for an Apex action is `aa:apex-<Class>`, `operation` the class name.
- **Hints:** `readOnly`, `destructive`, `idempotent`, `openWorld` tell clients how careful to be; set them truthfully.
- Deploy the widget and its types first or in the same deploy, then the definition.

## Tool descriptions

The description is what the model reads to choose and call the tool. Write:

1. What it answers, in one sentence, with the domain's words.
2. Every input with its valid values and what empty means.
3. Two example questions.
4. **"Send exactly one object in inputs: the result renders as a widget only for a single request. To compare ..., call the tool once for each."** The input schema is a list (`inputs: [ ... ]`), and clients use it to bundle requests - a bundled call renders as text only ([verified.md](verified.md#the-mcp-server)).

A changed description reaches clients after about two minutes; start a new conversation to load it.

## Activation

The definition has no active flag. A server is active when a Tooling API record `McpServerAccess` with `Active = true` points at it - what Setup's **Activate** creates. Activating opens the org to MCP clients: show it first (ground rule 7), then:

```bash
node <skill dir>/scripts/mcp-connect.mjs --target-org <alias> --server <name> --oauth-settings <eca>_glbloauth --activate
```

The script creates or updates the record and prints the URL and the OAuth client ID; without `--activate` it only reports. By hand:

```bash
sf data query --use-tooling-api -q "SELECT Id FROM McpServerDefinition WHERE DeveloperName = '<name>'" -o <alias>
sf data create record --use-tooling-api -s McpServerAccess -v "DeveloperName=<name> MasterLabel='<label>' Active=true McpServerId=<id>" -o <alias>
```

## URLs

| Org                                | Server URL                                                         | Sign-in at             |
| ---------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| Production, Developer Edition      | `https://api.salesforce.com/platform/mcp/v1/custom/<name>`         | `login.salesforce.com` |
| Sandbox, scratch org (`IsSandbox`) | `https://api.salesforce.com/platform/mcp/v1/sandbox/custom/<name>` | `test.salesforce.com`  |

Decide from `SELECT IsSandbox FROM Organization`. The guides describe a My Domain variant for orgs that block the shared login hosts.

## What the server returns

- `tools/list`: each tool with its input schema and `_meta.ui.resourceUri`. Tools the user's permission set does not grant are missing.
- `resources/read` on the `ui://` URI: an MCP App (`text/html;profile=mcp-app`) - Salesforce's widget renderer - with a CSP for the org's domain.
- `tools/call`: the action's result as text and as `structuredContent`, plus `_meta["salesforce/uiMetadata"]` with the resolved widget tree.
