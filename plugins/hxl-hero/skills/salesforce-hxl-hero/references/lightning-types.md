# Lightning types

For the MCP channel, two object-based custom Lightning types per tool connect the tool's result to the widget. They are `LightningTypeBundle` metadata in `lightningTypes/<name>/`, without a meta file. Salesforce's `platform-mcp-tool-widget-coordinate` skill describes the same model in more detail; this page is what a working chain needs.

| Type          | Name (convention)       | Models                                                     | Files                          |
| ------------- | ----------------------- | ---------------------------------------------------------- | ------------------------------ |
| Response type | `<toolApiName>Response` | The action's outputs, one property per output              | `schema.json`                  |
| Envelope type | `<toolApiName>`         | The tool result: `actionName`, `isSuccess`, `outputValues` | `schema.json`, `renderer.json` |

`<toolApiName>` is the class name in lower camel case without a trailing `Action`: `ArcadeHallOfFame` → `arcadeHallOfFame`. The widget is `<toolApiName>Widget`.

## From the describe

Deploy the Apex class first, then read its outputs:

```bash
sf api request rest '/services/data/v<api>/actions/custom/apex/<Class>' -o <alias>
```

Each entry of `outputs` becomes one property of the response type - not more, not fewer, no invented wrapper:

| Describe `type` (case-insensitive)                                           | Property `lightning:type`                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `STRING`, `TEXTAREA`, `PICKLIST`, `ID`, `REFERENCE`, `EMAIL`, `PHONE`, `URL` | `lightning__textType`                             |
| `INTEGER`, `INT`, `LONG`                                                     | `lightning__integerType`                          |
| `DOUBLE`, `DECIMAL`, `CURRENCY`, `PERCENT`                                   | `lightning__numberType`                           |
| `BOOLEAN`                                                                    | `lightning__booleanType`                          |
| `DATE` / `DATETIME`                                                          | `lightning__dateType` / `lightning__dateTimeType` |
| `null` with `"apexClass": "<Class>$<Inner>"` - a list or an object           | `@apexClassType/c__<Class>$<Inner>`               |

The mapping is the one Salesforce's `platform-mcp-tool-widget-coordinate` skill uses; Polyglot Arcade verified the text, integer, boolean and Apex class rows. The widget's schema has no integer type - integers are `lightning__numberType` there.

Generating the types from the describe with a small script keeps them in step with the class; rerun it after every change of the class's outputs. Never type a list as `lightning__listType` with `items` in a Lightning type - the metaschema rejects it; that belongs to the widget's schema.

## Response type

```json
{
  "title": "Arcade Hall of Fame Response",
  "description": "Output values of the ArcadeHallOfFame invocable action",
  "type": "object",
  "lightning:type": "lightning__objectType",
  "lightning:tags": ["mcp"],
  "unevaluatedProperties": false,
  "properties": {
    "hasEntries": { "title": "Has Entries", "lightning:type": "lightning__booleanType" },
    "entries": { "title": "Entries", "lightning:type": "@apexClassType/c__ArcadeHallOfFame$Entry" }
  }
}
```

## Envelope type

```json
{
  "title": "Arcade Hall of Fame",
  "description": "Result of the ArcadeHallOfFame MCP tool, rendered by the arcadeHallOfFameWidget HXL widget",
  "type": "object",
  "lightning:type": "lightning__objectType",
  "lightning:tags": ["mcp"],
  "unevaluatedProperties": false,
  "properties": {
    "actionName": { "title": "Action Name", "lightning:type": "lightning__textType" },
    "isSuccess": { "title": "Is Success", "lightning:type": "lightning__booleanType" },
    "outputValues": { "title": "Output Values", "lightning:type": "c__arcadeHallOfFameResponse" }
  }
}
```

`c__<response type>` is the response type's API name (its folder), not its title.

## The renderer

`renderer.json` sits in the **envelope** type, next to `schema.json`, without a channel subfolder:

```json
{
  "renderer": {
    "componentOverrides": {
      "$": {
        "definition": "@widget/c/arcadeHallOfFameWidget",
        "attributes": {
          "hasEntries": "{!$attrs.outputValues.hasEntries}",
          "entries": "{!$attrs.outputValues.entries}"
        }
      }
    }
  }
}
```

- **One binding per widget attribute**, each through `outputValues`. A binding without `outputValues` resolves against the envelope, where the data is not, and the widget shows nothing.
- **Lists bind as a whole** - `{!$attrs.outputValues.entries}` - and the widget iterates them. A list inside a wrapper object binds with three segments.
- **`c`** is the namespace of the widget in the definition, even in a namespaced org.
- The response type gets no renderer.

## Changes

- Adding an output: add it to the class, deploy, regenerate both the response type and the renderer, add the attribute to the widget's schema, deploy widget and types together.
- Renaming or removing an output breaks the chain until all four places agree; the checker of this skill reports where they disagree.
