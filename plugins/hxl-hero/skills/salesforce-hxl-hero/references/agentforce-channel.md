# The Agentforce channel

An Agentforce employee agent can show the same widget as the MCP clients, in the Agentforce panel of Lightning. Polyglot Arcade v1.2.0 verified it with its agent Arcade Host; read `agent/` and `docs/decisions/0004-arcade-host-agent.md` there. This reference covers what connects an agent to a widget. Authoring and testing the agent itself - subagents, instructions, test suites - belongs to an agent skill such as Salesforce's `agentforce-adlc`.

## What differs from the MCP channel

The widget stays the same file. The wiring around it does not.

|                  | MCP clients                                           | Agentforce in Lightning                                                      |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Action           | The Apex tool, with its fields as separate outputs    | An action with one output that holds the whole result                        |
| Lightning types  | Object-based: envelope and response                   | One Apex-backed type                                                         |
| Links the widget | `uiResource` of the tool in the MCP server definition | The output in Agent Script: `complex_data_type_name`, `is_displayable: True` |
| User             | OAuth through the External Client App                 | The Lightning session                                                        |
| Access           | The permission set that grants the tool class         | A licence, a standard permission set and `agentAccesses`                     |

## The org

A scratch org runs Agentforce with this in its definition, without Data Cloud and next to `hxlEnabled`. Features are set when an org is created, so an existing scratch org needs a new one - which also means connecting MCP clients again.

```json
{
  "features": ["Einstein1AIPlatform"],
  "settings": {
    "einsteinGptSettings": { "enableEinsteinGptPlatform": true },
    "agentPlatformSettings": { "enableAgentPlatform": true }
  }
}
```

Only scratch orgs are verified. In a Developer Edition or a sandbox, check it before promising it.

## One output

Agentforce renders a Lightning type on one output, and an MCP tool returns its fields one by one. Do not reshape a working tool: wrap it. The logic stays in one place and the MCP chain stays untouched.

```apex
global with sharing class ArcadeHallOfFameAgent {
  global class Result {
    @InvocableVariable(label='Hall of Fame' description='The ranking, as the widget shows it')
    global ArcadeHallOfFame.Response hallOfFame;
  }

  @InvocableMethod(label='Get Arcade Hall of Fame Card' description='...' category='Polyglot Arcade')
  global static List<Result> getHallOfFame(List<ArcadeHallOfFame.Request> requests) {
    List<Result> results = new List<Result>();
    for (ArcadeHallOfFame.Response response : ArcadeHallOfFame.getHallOfFame(requests)) {
      Result result = new Result();
      result.hallOfFame = response;
      results.add(result);
    }
    return results;
  }
}
```

Without an MCP tool to keep, a new action can return one object directly.

## The Apex-backed type

`schema.json` points at the class of the output. `renderer.json` sits at the root of the type, without a `lightningDesktopGenAi` folder, and binds the fields without `outputValues`:

```json
{
  "title": "Arcade Hall of Fame Card",
  "lightning:type": "@apexClassType/c__ArcadeHallOfFame$Response"
}
```

```json
{
  "renderer": {
    "componentOverrides": {
      "$": {
        "definition": "@widget/c/arcadeHallOfFameWidget",
        "attributes": { "title": "{!$attrs.title}", "entries": "{!$attrs.entries}" }
      }
    }
  }
}
```

Every widget attribute needs a binding, as in the [renderer of the MCP channel](lightning-types.md#the-renderer). A new field of a card needs a mapping in the renderers of both channels. `hxl-check` reports a widget that does not exist. It does not check these bindings, so check them by hand and in the panel.

## Agent Script

An employee agent has `agent_type: "AgentforceEmployeeAgent"`, no `default_agent_user`, no messaging variables and no escalation. It runs as the signed-in user. The action names the wrapper, and its only output links the type:

```text
actions:
    getHallOfFame:
        target: "apex://ArcadeHallOfFameAgent"
        outputs:
            hallOfFame: object
                description: "The ranking, shown as the card"
                label: "Hall of Fame"
                complex_data_type_name: "c__arcadeHallOfFameCard"
                filter_from_agent: False
                is_displayable: True
```

Without further instruction the model repeats the card in words. Ask in the subagent's reasoning instructions for at most one short sentence next to the card.

## Access

A user needs the permission set licence `EinsteinGPTCopilotPsl`, the permission set `CopilotSalesforceUser` and a permission set of the project with `agentAccesses` for the agent and `classAccesses` for the wrappers. The tool classes come with the permission set the MCP channel already needs. Without the project's permission set there is no Agentforce icon and no error, so this is the first thing to check when the panel does not show up. A scratch org has three of these licences.

## Shipping it

`sf agent publish authoring-bundle` and `sf agent activate` need no clicks in Setup. A setup step that is safe to run again has to handle a few things:

- **Keep the agent out of the main deploy.** An org without Agentforce cannot deploy it, and a permission set with `agentAccesses` fails until the agent is published. Polyglot Arcade keeps both in `agent/`, which is not a package directory, and skips an org without the licence with a message.
- **Work in a temporary project.** `sf agent publish` retrieves generated `aiAgents/` and `aiAgentDefinitionVersions/` and the action classes, with whitespace changes, into the project it runs in. A deploy from that project needs `--ignore-conflicts` in a scratch org.
- **Publish only what changed.** Every publish adds a version. The org lists them as `AiAuthoringBundle` `<Agent>_<N>`; retrieve the highest and compare its `.agent` file.
- **Always name the version.** See [verified.md](verified.md#agentforce-in-lightning): without `--version`, `sf agent activate --json` can move the agent back. Read `BotVersion` and activate only when the latest is not active.
- **Tolerate a duplicate assignment.** `sf org assign permset` exits with an error when the permission set is already assigned.

## Trying it

- **Preview the published agent:** `sf agent preview start --api-name <Agent>`, then `send`. `--authoring-bundle` crashes for an employee agent. The result holds the structured output, which an acceptance can assert: `.result.messages[].result[].value.<output>`.
- **Check that a publish worked before trusting the panel.** After a failed publish the panel keeps answering with the previous version, which looks like a failing widget.
- **In the panel:** the first time, two dialogs ask for confirmation. Try several users, the empty state and both button actions. A new user who has only an API session lands on "Change Your Password"; after a password is set through the API, **Cancel** leads on.
