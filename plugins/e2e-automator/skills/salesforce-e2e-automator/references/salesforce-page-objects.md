# Salesforce page objects

How to find and chain the page objects Salesforce publishes for Lightning Experience. The names below are starting points that have been stable for many releases - confirm each one with `show` in the project before you use it, and follow the return types from there. The package the project has installed is the truth; this page is the map.

## How a chain works

- Only **root** page objects can be loaded: `await utam.load(RecordActionWrapper)`. `utam.load` waits until the root element is present.
- Everything else is reached through **getters and methods** of its parent, each returning the next page object. The chain mirrors the component tree, shadow root by shadow root - that is what makes UTAM survive DOM changes inside components.
- Every call returns a promise: `await` each step. Keep chains readable - one `const` per page object the test uses again, not one long expression.
- A getter **finds the element now**; it does not wait. Methods named `waitFor...` and methods that say "waits for" in their description do. With `implicitTimeout: 0` (the template's setting), calling a getter before the component has rendered fails at once - use the waiting method, or a `waitFor` around the getter.

## Entry points

| Part of Lightning Experience        | Root page object (import path after `salesforce-pageobjects/`)                                  | Typical next steps                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Navigation bar, app name, tabs      | `navex/pageObjects/desktopLayoutContainer`                                                      | `getAppNav()` → `getAppNavBar()` → `getNavItem('Accounts')`; `getAppName()`     |
| App launcher                        | `global/pageObjects/appLauncherMenu`                                                            | after clicking the launcher button in `getAppNav()` → `getAppLauncherHeader()`  |
| List view (object home)             | `lists/pageObjects/objectHome`                                                                  | `getListViewManager()` → list, header, actions                                  |
| New / edit record modal             | `global/pageObjects/recordActionWrapper`                                                        | `getRecordForm()` → `getRecordLayout()` → items; `clickFooterButton('Save')`    |
| Record page                         | `global/pageObjects/recordHomeFlexipage2` (interface)                                           | `getHighlights()` → `getActions()`; `getTabset()` → tabs, detail panel          |
| Quick action                        | `action/pageObjects/quickActionWrapper`                                                         | `getQuickActionPanelContent(...)`, `getButtonByText(...)`                       |
| Toast                               | `lightning/pageObjects/toast`, older pages `force/pageObjects/toastMessage`                     | `getMessageText()`, `getVariant()`, `close()`                                   |
| Login page (username and password)  | `helpers/pageObjects/login`                                                                     | only for orgs without the CLI login - the template logs in with a frontdoor URL |
| Base components inside your own LWC | `lightning/pageObjects/<name>` - `lightning-input` → `input`, `lightning-combobox` → `combobox` | used as `type` in custom page objects                                           |

For anything else, search by the tag name you see in the browser's element inspector - `search records-record-layout-item`, `search lightning-datatable` - or by words from what the component does (`search related list`).

## Interfaces

Some page objects are interfaces - the record page `recordHomeFlexipage2` is the common one. Which implementation is used depends on the page layout and is decided at run time by the injection config `salesforce-pageobjects/ui-global-components.config.json`, which `wdio.conf.js` loads through the UTAM service. `show` lists the implementations. Load the interface, not an implementation, unless a test is about one specific template.

## Containers

A **container** getter takes the page object to return as an argument, because its content is not known in advance - a slot, a flexipage region, a modal body:

```js
const component = await tab.getComponent2('<component id>');
const productFilter = await component.getContent(ProductFilter);
```

This is how a custom Lightning web component on a Lightning page is reached: through the flexipage component wrapper `flexipage/pageObjects/component2` and its `getContent(...)`, with your own page object as the argument. For record pages, the tabs of `getTabset()` lead there; for app pages with their own region layout, see the app page pattern in [custom-page-objects.md](custom-page-objects.md#lightning-pages).

## Record forms

The new, edit and detail forms render fields as `records-record-layout-item`. Its page object (`records/pageObjects/recordLayoutItem`) knows its field: `getTargetField()` returns the field's API name reference, `getLabelText()` its label. `getTextInput()`, `getPicklist()`, `getLookup()` and `getDatepicker()` return the base component page objects to fill it.

Find fields by API name, not by position:

- `getSection(1)` → `getRow(2)` → `getItem(1)` breaks as soon as an admin moves a field on the layout - and on every layout that differs between profiles or record types.
- A label breaks with every translation and every relabel.
- The API name stays. The helper pattern is in [writing-specs.md](writing-specs.md#fields-by-api-name).

## When the page object and the page disagree

A method that times out or a getter that finds nothing usually means one of three things:

1. **Wrong place in the chain.** The page shows a different template than you assumed - a record page with a subheader, a modal instead of a full page. Inspect the page (headed run, see [run-and-debug.md](run-and-debug.md)) and compare the tags with the selectors in the page object's `.utam.json` source.
2. **Not loaded yet.** Use the waiting method of the parent, or wait for the element before the getter.
3. **The release moved it.** Compare the page object's source in the installed version with the previous version (`npm pack salesforce-pageobjects@<old>` into a scratch folder) - see [maintenance.md](maintenance.md#salesforce-releases).

The UTAM Chrome extension helps with the first: it imports the package (`npm pack salesforce-pageobjects`), lists the root page objects that match the open page and highlights what each method touches. Suggest it to users who want to explore a page themselves.
