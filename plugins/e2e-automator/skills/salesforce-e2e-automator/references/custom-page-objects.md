# Custom page objects

JSON page objects for the project's own Lightning web components and Lightning pages. They are the part of a UTAM suite that needs the most care: a good one hides the component's DOM behind a few methods that read like the user's actions, so a change to the component means one edited file instead of ten broken specs.

## Where they live

| What                                      | File                                                                      | Compiled to                   | Referenced as `type`                 |
| ----------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- | ------------------------------------ |
| Lightning web component `c-order-summary` | `force-app/main/default/lwc/orderSummary/__utam__/orderSummary.utam.json` | `pageObjects/orderSummary.js` | `utam-sfdx/pageObjects/orderSummary` |
| A Lightning page                          | `force-app/main/default/flexipages/__utam__/<page>.utam.json`             | `pageObjects/<page>.js`       | `utam-sfdx/pageObjects/<page>`       |

One page object per component, named like the component's folder. Specs import the compiled file relatively, e.g. `import OrderSummary from '../../../pageObjects/orderSummary.js';` from `force-app/test/utam/`. `utam-sfdx/` resolves through the alias in `utam.config.js` - see [setup.md](setup.md) for the value that works.

## Start from the component source

Read the component's HTML templates, its JavaScript (render mode, public properties, events) and the children it renders. Then translate:

| In the component                                 | In the page object                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Markup of a regular LWC (shadow DOM)             | elements inside `"shadow": { "elements": [...] }`                                       |
| `static renderMode = 'light'`                    | elements directly under `"elements"`, no `shadow`                                       |
| `<lightning-input>`, `<lightning-combobox>`, ... | `"type": "salesforce-pageobjects/lightning/pageObjects/<name>"` - confirm with `search` |
| `<c-order-line>`                                 | `"type": "utam-sfdx/pageObjects/orderLine"` - its own page object                       |
| A plain element to click, type into or focus     | `"type": ["clickable"]`, `["editable"]`, `["actionable"]` - combinable                  |
| A plain element only to read                     | no `type` - text, attributes, presence and visibility are always available              |
| `for:each` / `iterator`                          | `"returnAll": true`; to pick one by its content, a `filter`                             |
| `lwc:if` the test checks the absence of          | `"nullable": true` - the getter returns `null` instead of failing                       |
| `lwc:if` the test waits for                      | `"wait": true` - generates `waitFor<Name>()`                                            |
| `<slot>` content, a region filled from outside   | `"type": "container"` - the test passes the page object to expect                       |

Model only what the tests use. A page object grows with the tests, not with the component.

## Selectors

- **Prefer hooks that exist for testing or for meaning:** a `data-id` attribute, the component tag, a class from the component's own CSS. If the markup has nothing stable, suggest adding `data-id` to the component - a one-line change that the team reviews like any other.
- **Avoid** SLDS utility classes (`slds-m-around_small`), generated ids, text content, and `:nth-child` on lists that change.
- **One shadow root per level.** A selector never crosses a shadow boundary; each component's shadow root is its own `shadow` block, usually its own page object.
- **Parameters:** `%s` and `%d` in the selector, declared in `"args"`, become arguments of the generated getter.

## Methods over elements

Tests should read like the story: `filterLines('Pro')`, `waitForTotal('€ 1,200.00')`, `getLineByProduct('E-Bike Pro')`. So:

- Expose **compose methods** for what the user does and sees; keep elements private (`public` left out) unless a test needs the element or the child page object itself.
- Put the **waits inside** the methods: a method that changes something waits for the result, a method a test asserts on has a `waitFor...` twin with the expected value as argument.
- Give the page object and every method a **description**, with an `author` - the linter warns without them, and the description is what the next person reads.

## Example

A component that filters order lines and shows a total - compiled and linted with the current compiler:

```json
{
  "description": {
    "author": "Acme QA",
    "text": ["Order summary card: filter the lines, find a line by product, read and wait for the total."]
  },
  "shadow": {
    "elements": [
      {
        "name": "search",
        "type": "salesforce-pageobjects/lightning/pageObjects/input",
        "selector": { "css": "lightning-input[data-id='search']" }
      },
      {
        "name": "lineByProduct",
        "public": true,
        "type": "utam-sfdx/pageObjects/orderLine",
        "selector": { "css": "c-order-line", "returnAll": true },
        "filter": {
          "apply": "getProductName",
          "matcher": { "type": "stringEquals", "args": [{ "name": "productName", "type": "string" }] },
          "findFirst": true
        }
      },
      { "name": "total", "selector": { "css": "[data-id='total']" } }
    ]
  },
  "methods": [
    {
      "name": "filterLines",
      "description": { "text": ["Types a search term into the filter"] },
      "compose": [{ "element": "search", "apply": "setText", "args": [{ "name": "term", "type": "string" }] }]
    },
    {
      "name": "waitForTotal",
      "description": { "text": ["Waits until the total shows the expected text"] },
      "args": [{ "name": "expected", "type": "string" }],
      "compose": [
        {
          "apply": "waitFor",
          "args": [
            {
              "type": "function",
              "predicate": [
                {
                  "element": "total",
                  "apply": "getText",
                  "matcher": { "type": "stringEquals", "args": [{ "name": "expected", "type": "argumentReference" }] }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "isEmpty",
      "description": { "text": ["True when the card shows its empty state"] },
      "compose": [
        {
          "element": "root",
          "apply": "containsElement",
          "args": [{ "type": "locator", "value": { "css": "[data-id='empty']" } }, { "value": true }]
        }
      ]
    }
  ]
}
```

The compiler turns this into `filterLines(term)`, `waitForTotal(expected)`, `isEmpty()` and `getLineByProduct(productName)` - the filter calls `getProductName()` of each `c-order-line` page object and returns the first match. The second argument of `containsElement` (`true`) makes it look inside the shadow root.

For anything beyond this - element lists in compose, `beforeLoad`, interfaces, frames, imperative extensions - read the grammar page for that topic ([sources.md](sources.md)) before writing it. Imperative extensions are the last resort: they are JavaScript the compiler cannot check.

## Generate a first draft

For a component with a large template, the generator in the `utam` package writes a draft from the HTML. A config that maps base components and the project's own components to the right types:

```json
{
  "inputRootDir": "force-app/main/default/lwc",
  "inputFileMask": ["orderSummary/*.html"],
  "relativeOutputDir": true,
  "outputDir": "__utam__",
  "overrideExisting": false,
  "namespaces": {
    "lightning": "salesforce-pageobjects/lightning/pageObjects/",
    "c": "utam-sfdx/pageObjects/"
  }
}
```

Run it with `npx utam-generate -c <config file>`, one component at a time. Keep `overrideExisting: false` - the default overwrites page objects someone already curated. The draft makes every element public, adds no waits, no methods and no `nullable`, and uses positional selectors for lists. Treat it as a list of what is there: make elements private, add the methods and waits the tests need, and drop what they do not.

## Lightning pages

A custom component on a Lightning page is reached through the page's flexipage structure, which Salesforce generates from the page's API name and template. Before modelling it yourself, search for a Salesforce page object of that template (`search flexipage --root`, `search template`). If there is none, model the page once, in its own page object:

- `"root": true` with `"selector": { "css": "body" }` - the page as a whole.
- An element for `app_flexipage-lwc-app-flexipage`, then the internal shadow levels down to the regions, then `flexipage-component2` typed as `salesforce-pageobjects/flexipage/pageObjects/component2`, public.
- A method per region that waits for the page to load and returns that `component2`; the spec calls `getContent(OrderSummary)` on it.

The region tags (`forcegenerated-flexipageregion_<page>_<region>__js` and similar) come from the page's metadata - read them in a headed run with the element inspector. The eBikes sample app has a complete three-region app page (`force-app/main/default/flexipages/__utam__/`). This structure is Salesforce-internal and may change with a release; keeping it in one page object means one file to fix.

## Check before you run

```bash
npm run test:ui:compile
```

The compiler fails on grammar errors with a code and the element or method - look the code up on the error codes page if the message is not enough. Then read the linter's report, `utam-lint.sarif`: duplicate selectors, missing descriptions, an element that should use an existing page object's type. Fix warnings in files you wrote in this session.
