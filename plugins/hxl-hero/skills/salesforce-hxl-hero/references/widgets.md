# Widgets

A widget is a `UiWidgetBundle` in `uiWidgets/<name>/` with three files. It knows nothing about the tool or the envelope - its attributes arrive through the renderer of the envelope type ([lightning-types.md](lightning-types.md#the-renderer)). Salesforce's `platform-widget-generate` skill and its references are precise on components, formulas and styling; read them for anything this page does not cover.

| File                       | Holds                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `<name>.json`              | `{ "type": "lightning__agentforceWidget", "contentBody": { "widgetBody": { ... } } }`, root `tile/widget` |
| `schema.json`              | The attribute contract: `properties.attributes` (`lightning__objectType`) with one property per attribute |
| `<name>.uiwidget-meta.xml` | `masterLabel`, `description`, `widgetType` `JSON`                                                         |

## The palette

Read it from the org, not from memory:

```bash
sf api request rest '/services/data/v<api>/actions/standard/discoverUiComponents' --method POST \
  --body '{"inputs":[{"pageType":"FRAGMENT"}]}' -o <alias>
sf api request rest '/services/data/v<api>/actions/standard/getUiComponentSchemas' --method POST \
  --body '{"inputs":[{"pageType":"FRAGMENT","componentDefinitions":["tile/row","tile/text","tile/button"]}]}' -o <alias>
```

The schemas name every property, its enum and its default. Leave out an attribute whose value equals the default. At Winter '27 the palette was `tile/*`: layout (`column`, `row`, `container`, `separator`, `spacer`), content (`text`, `markdown`, `code`, `image`, `icon`, `avatar`, `badge`, `progress`, `callout`, `link`, `spinner`), collections (`list`, `listitem`, `table`, `accordion`, `accordionitem`) and `button`.

## Composition

```json
{
  "definition": "tile/row",
  "meta": { "forEach": "{!$attrs.entries}", "forItem": "$entry" },
  "attributes": { "justify": "between" },
  "children": [
    { "definition": "tile/text", "attributes": { "text": "{!$entry.player}", "weight": "semibold" } },
    { "definition": "tile/text", "attributes": { "text": "{!FORMATNUMBER($entry.score)}", "variant": "h3" } }
  ]
}
```

- **Root:** `tile/widget`, then one `tile/column` that holds everything.
- **Bindings:** `{!$attrs.<attribute>}` for the widget's attributes, `{!$<item>.<field>}` inside a `forEach`. Every `$attrs` name must exist in `schema.json`.
- **`meta.forEach` / `forItem`** repeat a component per list item; **`meta.if`** includes it when a boolean is true. `if` needs a real boolean - an attribute like `hasEntries` or a comparison - never a string or a number.
- **Formulas** inside `{! }`: `IF`, `AND`, `NOT`, `ISBLANK`, `TEXT`, `&` for text, `FORMATNUMBER`, `CASE` and more - only the functions the documentation or Salesforce's `widget-formulas` reference lists. Both branches of an `IF` have the same type; numbers become text with `TEXT()`.
- **Lists in `schema.json`:** `"lightning:type": "lightning__listType"` with `"items": { "lightning:type": "@apexClassType/c__<Class>$<Inner>" }` - the item's fields are not repeated.

## Actions

A `tile/button` without an action renders disabled. Two actions exist:

```json
{ "definition": "tile/button", "attributes": {
    "label": "My player card", "variant": "secondary", "iconName": "user",
    "actions": { "click": [ { "definition": "action/sendMessage", "attributes": { "content": "Show my Polyglot Arcade player card." } } ] } } }
```

- **`action/openLink`** opens `url` - for the app where the user acts. Take the URL from the tool's result (configuration in the org), never type it into the widget.
- **`action/sendMessage`** posts `content` as a new message of the user, and the client answers it - usually with another tool. Phrase it as the user would ask, with the product's name, so the model picks the right tool.

## Style

- Semantic variants, not colours or pixels: `variant`, `size`, `color` from the component's enum.
- One `h1`, at most one `primary` button per group; icons from the documented icon names (Lucide).
- Empty and error states as a `tile/callout` with the result's message, behind `meta.if`.
- A button that stands alone stretches in a column - wrap it in a `tile/row` to keep its width.
- The client renders in its own theme, light or dark; do not assume a background.

## Checking a widget

- Every `$attrs` binding resolves to a schema property, every schema property is bound in the renderer - the checker of this skill reports both.
- Render it without the client with `mcp-try.mjs render` ([testing.md](testing.md#rendering-a-widget)) - in both themes, with real data and with the empty state.
