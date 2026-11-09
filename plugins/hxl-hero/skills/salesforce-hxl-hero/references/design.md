# Design

How to decide what an HXL experience shows, where, and for whom - before the first file. The shapes come from Polyglot Arcade's headless surface and its ADR 0003; check the platform facts for the org's release ([sources.md](sources.md)).

## When HXL fits

| Fits                                                                         | Does not fit                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Answers worth seeing: a ranking, a card, a short list, a status with numbers | Data entry - widgets have no input fields                                     |
| Questions people ask in a client they already use - Claude, ChatGPT, Slack   | Real-time interaction - a game loop, key input, drag and drop                 |
| The same records the apps use, under the asking user's permissions           | Writes without a human in the loop, or anything the user may not do in the UI |
| A next step as a button: open the app, ask the follow-up question            | Long workflows with many steps - that is an app or an agent with topics       |

A widget is a view of one tool result. It shows data and offers buttons; buttons open a link or post a message as the user, which the client answers with another tool. That is enough for "show me and take me there" - not for an app.

### Turn-based play

A turn-based game or a choice made step by step does fit: every click is one model turn and one tool call, and the click is the human in the loop. Polyglot Arcade v1.3.0 plays Four in a Row this way in Claude and in the panel ([ADR 0005](https://github.com/svierk/polyglot-arcade/blob/v1.3.0/docs/decisions/0005-games-in-the-chat.md)). The tool took about one second per move, including the CPU's search, on top of the model's turn, and each move adds a widget to the conversation.

- **The state lives on the server,** in a private record owned by the player and locked `FOR UPDATE` while a move runs. The model only names the choice; Apex checks it and works out the result.
- **A step number in the button's message makes a repeat harmless.** Every old widget keeps its buttons and clients can call twice. A number that is not the next one changes nothing and shows the current state. Set the tool's `readOnly` and `idempotent` hints to false.
- **Test every end state.** A formula that fails at the end of a game turns the saved result into an error for the user ([verified.md](verified.md#lightning-types-and-widgets)).
- **In the Agentforce panel** the board has to be forced onto the screen: [when the card has to appear](agentforce-channel.md#when-the-card-has-to-appear).

## Channels

| Channel                                | Wiring                                                                                                                     | Status to check                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Claude, ChatGPT, Slackbot through MCP  | A custom MCP server, an External Client App for OAuth, two object-based Lightning types per tool (envelope and response)   | HXL guide `hxl-mcp-channels`; Slackbot with Block Kit renders no widgets                             |
| Agentforce employee agent in Lightning | An action with one output, one Apex-backed Lightning type with a renderer ([agentforce-channel.md](agentforce-channel.md)) | HXL guide `agentforce-action-output`; Salesforce's `platform-lightning-type-widget-coordinate` skill |

The widget is the same in both; the types and the wiring differ. Start with one channel and verify it end to end before adding the next. Polyglot Arcade verified the MCP channel with Claude in v1.1.0 and the Lightning channel in scratch orgs in v1.2.0 ([verified.md](verified.md)).

## Tools from questions

1. **Collect the questions** in the users' words: "who is this week's champion?", "how am I doing?", "which accounts played?". Group them by what they need to answer.
2. **One tool per kind of question.** The arcade has two: a ranking (`getHallOfFame`) and a person's card (`getPlayerCard`). A tool per object ("getScores") leaves the shaping to the model; a tool for everything gives the model nothing to choose by.
3. **Few, forgiving inputs.** A name or a key, matched case- and punctuation-insensitive; a period as `today`, `week`, `month`, `all`; empty meaning a sensible default (all games, the person who asks). Unknown values return a message with the valid ones, not an error.
4. **Outputs for the widget and the model.** What the widget shows, plus flags that drive it (`hasEntries`, `allGames`), plus a `message` for empty and unknown cases. The model reads the same result - names and descriptions matter.
5. **Buttons for the next step.** `action/openLink` to the app where the user acts (its URL from configuration, never typed in); `action/sendMessage` with the follow-up question, so widgets lead to each other.

## Widgets from tools

- **Sketch from the org's palette** (`discoverUiComponents`), not from memory.
- **One `h1`, one primary button** per widget; the domain's vocabulary and order - a leaderboard row looks like the apps' leaderboard rows.
- **Empty and error states** as a callout with the result's `message`; the list only when there is something to list.
- **Numbers formatted in the widget** (`FORMATNUMBER`), dates already formatted by Apex in the asking user's locale and time zone when the widget's date functions are unclear for the release.

## In the architecture

The headless surface is a surface of its own: no UI to build, one role - answering questions on the shared data - and no data path of its own. It is not an integration pattern for embedding; Polyglot Arcade keeps its four patterns and records the headless surface in ADR 0003. Write a decision record for it in the project, with what was verified in the org.
