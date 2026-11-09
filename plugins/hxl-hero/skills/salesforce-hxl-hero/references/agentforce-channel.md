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
| Access           | The permission set that grants the tool class         | A permission set with `agentAccesses`                                        |

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

Agentforce ties a Lightning type to one output, which has to hold the whole card. Other outputs can sit next to it: in Salesforce's [Pronto sample](https://github.com/trailheadapps/pronto), `GetCustomerReviewsAction` returns `isSuccess`, `message` and `reviews`, and the panel renders the widget on `reviews`. An MCP tool that returns its fields one by one has no such output. Do not reshape a working tool: wrap it. The logic stays in one place and the MCP chain stays untouched.

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

Without an MCP tool to keep, a new action can return one object directly. Pronto uses that action for both channels, and its MCP renderer binds through the object: `{!$attrs.outputValues.reviews.items}`. That binding is read from its source, not tried.

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

The model can repeat the card in words, so Polyglot Arcade asks in the subagent's reasoning instructions for at most one short sentence next to the card. Pronto has no such sentence, and its model did not repeat the card in five tries. Check it in the panel.

An instruction such as "if `hasRounds` is false, show the message" can replace the card: for a player without rounds, Polyglot Arcade's agent answered once with text only and once with the card.

## When the card has to appear

The model decides each turn whether to run the action and whether to show its card. For a card the user cannot go on without, such as the board of a game, that is too loose. Polyglot Arcade v1.3.0 found these in the traces of the preview:

- **The model can claim an action it did not make.** A move was answered with "The disc was dropped in column 4", with no call and no change.
- **A card needs a second step.** It appears only when the model calls `__show_tool_results__` after the action. A deterministic `run @actions` runs the action and shows nothing, and "reply with the message" produces text without a card.
- **The caption is the text above the card.** Asking for a field the card also shows prints it twice. Name a fixed sentence.
- **"Call it for every message" loops** until the agent gives up with "I have reached my processing limit".

What worked for 32 of 32 moves in the preview and a full game in the panel: a subagent of its own with one action, a bound input so the model has nothing to fill in, the action available once per turn, and one instruction for each half of the turn. The wrapper's Apex reads the move from the sentence.

```text
before_reasoning:
    set @variables.move_played = False

reasoning:
    instructions: ->
        if @variables.move_played == False:
            | Call play_four_in_a_row now, before you write anything.
        else:
            | The move is played. Show its result with __show_tool_results__, with exactly "Here is the board." as the caption.
    actions:
        play_four_in_a_row: @actions.playFourInARow
            available when @variables.move_played == False
            with message = @system_variables.user_input
            set @variables.move_played = True
```

Keep this for actions that need it. It takes the choice away from the model, which an ordinary question does not want.

## Links in a widget

A link to the org's `my.salesforce.com` domain in an action's output arrives as the text `URL_Redacted` ([verified.md](verified.md#agentforce-in-lightning)), so a button leads to a page that does not exist. Let the wrapper return a path such as `/lightning/app/c__<app>/n/<tab>`, and keep the full URL for the MCP channel. The replaced link is visible in the output of `sf agent preview`, so check it there before opening the panel.

## Access

A user needs a permission set of the project with `agentAccesses` for the agent and `classAccesses` for the wrappers. The tool classes come with the permission set the MCP channel already needs. Without the project's permission set there is no Agentforce icon and no error, so this is the first thing to check when the panel does not show up.

The licence `EinsteinGPTCopilotPsl` (_Agentforce (Default)_) and the permission set `CopilotSalesforceUser` are not needed in a scratch org. The licence carries the name of Salesforce's older default agent, which Salesforce no longer develops further. Other org types are not verified, so check there whether your users need a licence.

## Shipping it

`sf agent publish authoring-bundle` and `sf agent activate` need no clicks in Setup. A setup step that is safe to run again has to handle a few things:

- **Keep the agent out of the main deploy.** An org without Agentforce cannot deploy it, and a permission set with `agentAccesses` fails until the agent is published. Polyglot Arcade keeps both in `agent/`, which is not a package directory, and skips an org that does not list the metadata type `AiAuthoringBundle` with a message.
- **Work in a temporary project.** `sf agent publish` retrieves generated `aiAgents/` and `aiAgentDefinitionVersions/` and the action classes, with whitespace changes, into the project it runs in. A deploy from that project needs `--ignore-conflicts` in a scratch org. Publishing inside the project has two costs: classes in subfolders come back as flat copies in `classes/`, and the next deploy of that folder fails with `Can't edit an active bot version`, unless `.forceignore` lists `**/aiAgents/**` and `**/aiAgentDefinitionVersions/**`.
- **Publish only what changed.** Every publish adds a version. The org lists them as `AiAuthoringBundle` `<Agent>_<N>`; retrieve the highest and compare its `.agent` file.
- **Always name the version.** See [verified.md](verified.md#agentforce-in-lightning): without `--version`, `sf agent activate --json` can move the agent back. Read `BotVersion` and activate only when the latest is not active.
- **Tolerate a duplicate assignment.** `sf org assign permset` exits with an error when the permission set is already assigned.

## Trying it

- **Preview the published agent:** `sf agent preview start --api-name <Agent>`, then `send`. `--authoring-bundle` crashes for an employee agent. The result holds the structured output, which an acceptance can assert: `.result.messages[].result[].value.<output>`.
- **Read the traces when a card or a call is missing.** They are in `.sfdx/agents/<id>/sessions/<session>/traces/<plan>.json`: `FunctionStep` for an action, `PlatformActionStep` for `__show_tool_results__`, `PlannerResponseStep` for the text and the shown result.
- **Check that a publish worked before trusting the panel.** After a failed publish the panel keeps answering with the previous version, which looks like a failing widget.
- **In the panel:** the first time, two dialogs ask for confirmation. Try several users, the empty state and both button actions. A new user who has only an API session lands on "Change Your Password"; after a password is set through the API, **Cancel** leads on.
