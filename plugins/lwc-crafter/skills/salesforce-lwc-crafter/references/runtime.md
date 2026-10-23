# Runtime

How a component renders, reacts, lives and dies - and the habits that keep it fast and leak-free.

## Templates

- **`lwc:if`, `lwc:elseif`, `lwc:else`** for conditions. `if:true` and `if:false` are deprecated.
- **Getters for anything computed.** Templates take properties, not expressions: `{isEmpty}` backed by `get isEmpty() { return this.items.length === 0; }`. A getter runs on every render - keep it cheap; compute expensive values once when the data arrives.
- **Lists:** `for:each` with `key` set to a unique, stable value from the item - never the index, which makes the engine reuse the wrong rows when the list changes. `iterator` when the template needs `first` or `last`.
- **Element references with `lwc:ref`** (`<div lwc:ref="chart">`, then `this.refs.chart`), or `this.template.querySelector` for elements that `lwc:ref` cannot reach, such as items inside a loop. Never `document.querySelector` - it searches the whole page.
- **`lwc:spread`** passes many properties to a child at once - the collection hands its datatable settings over this way.
- **Data attributes** (`data-id={item.id}`) to find out which item an event came from: `event.currentTarget.dataset.id`.
- **Slots** for content the parent provides, rather than properties full of markup.

## Reactivity

- **Every field is reactive.** A new value for a field re-renders the template. `@track` is only needed when the code changes the inside of an object or array in place - and replacing it is usually clearer: `this.items = [...this.items, item]`.
- **Do not change what you received** - wired data, `@api` values, `event.detail`. Copy, change the copy, assign it.
- **Private fields** for internal state; the collection prefixes them with `_` (`_currentPage`). Only `@api` fields are visible from outside.

## Lifecycle

| Hook                   | Use it for                                                                           | Never                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `constructor`          | Nothing, usually. If needed: `super()` first, initial private state                  | Reading `@api` properties or the template, dispatching events, fetching data                            |
| `connectedCallback`    | Setup: subscriptions, listeners on `window` or `document`, timers, loading a library | Assuming it runs once - it runs again when the element is moved; guard one-time work                    |
| `renderedCallback`     | Work that needs the rendered DOM: measuring, handing a container to a library        | Changing state unconditionally or changing a wire parameter - an endless render loop. Guard with a flag |
| `disconnectedCallback` | Cleanup of everything `connectedCallback` started                                    | Skipping it because "the page reloads anyway" - in a console app it does not                            |
| `errorCallback`        | An error boundary: show a fallback when a child component throws                     | Swallowing errors without showing them                                                                  |

**What a component starts, it stops.** Listeners on `window` or `document`, `setInterval` and `setTimeout`, `requestAnimationFrame` loops, `ResizeObserver` and other observers, Lightning Message Service and EMP API subscriptions, camera streams, third-party chart instances. Two details that make cleanup work:

```js
handleResize = () => { this.measure(); };      // a class field: the same function for add and remove

connectedCallback() {
  window.addEventListener('resize', this.handleResize);
}

disconnectedCallback() {
  window.removeEventListener('resize', this.handleResize);
}
```

`addEventListener('x', this.handler.bind(this))` cannot be removed - every `bind` creates a new function. Listeners on elements of the component's own template need no cleanup; declare them in the template (`onclick={handleClick}`) where possible. LWC does not support capture-phase listeners - `{ capture: true }` silently does nothing.

## DOM work

- **The template renders.** Show and hide with `lwc:if`, set classes and styles through getters - not by adding classes or attributes to queried elements by hand.
- **Manual DOM only for third-party libraries**, inside an element marked `lwc:dom="manual"`, so the engine leaves its children alone.
- **No generated class names or attributes** (`lwc-...`, `c-component_component`) in code or tests - they change at any time.
- **Light DOM** (`static renderMode = 'light'`) only when there is a reason: global styling, a library that needs to reach in. It drops the encapsulation - and with it a security boundary - for that component.

## Third-party libraries

1. **Static resource**, uploaded from a known version with its license checked - never a CDN URL. The Content Security Policy blocks other hosts anyway.
2. **Load once** with `loadScript` or `loadStyle` from `lightning/platformResourceLoader` and the URL from `@salesforce/resourceUrl/<name>`; keep a loaded flag, catch the error and show it - the collection's `qrCodeGenerator` and `orgChartViewer` do both.
3. **Render into a `lwc:dom="manual"` container**, found with `lwc:ref` after the first render.
4. **Dispose** of the library's instance, observers and animation loops in `disconnectedCallback` - `orgChartViewer` disconnects its `ResizeObserver` there.
5. **Check compatibility.** Libraries that need Web Workers, `document.write` or `eval` do not work under Lightning Web Security, however they are loaded.

## Async work

- **`async`/`await` with `try`/`catch`/`finally`** around every call that can fail - the loading flag goes off in `finally`, so it never sticks.
- **Parallel calls** with `Promise.all` when they do not depend on each other.
- **Debounce input** that triggers a server call, and clear the pending timer in `disconnectedCallback`.
- **No `setTimeout` to wait for rendering.** Use `renderedCallback`, or `await Promise.resolve()` after a state change when the next step needs the new DOM.
- **Tell the user.** A spinner while loading, a toast (`ShowToastEvent`) or an inline message when something fails - not a line in the console.

## Navigation and dialogs

- **`NavigationMixin`** from `lightning/navigation` with page references (`standard__recordPage`, `standard__objectPage`, `standard__namedPage`, ...) - URLs differ between Lightning Experience, the mobile app and Experience Cloud. For links, generate the URL with `[NavigationMixin.GenerateUrl]` and put it in `href`, so open-in-new-tab works.
- **Modals** with `lightning/modal`, not hand-built markup - it handles focus, keyboard and screen readers.
- **Alerts and confirmations** with `LightningAlert`, `LightningConfirm` and `LightningPrompt`. Native `alert()` and `confirm()` are blocked in cross-origin frames and do not look like Lightning.

## Performance

- **Render less:** `lwc:if` instead of hiding with CSS for content that is expensive to build; split long lists into pages.
- **Fetch less:** see [data.md](data.md#large-data).
- **Load late:** libraries only when the feature that needs them is used.
- **Cache derived values** when the data changes, not in getters that run on every render.
- **Images** in the size they are shown, from a static resource or the org's files.
