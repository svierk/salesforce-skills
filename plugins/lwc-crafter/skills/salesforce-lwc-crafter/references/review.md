# Review

Reviewing components and finding out why one is broken. The tools find patterns; the checklist finds what only reading the code shows.

## Checker rules

`scripts/lwc-check.mjs` checks JavaScript, templates, CSS, `js-meta.xml` and Jest tests inside `lwc` folders. Comments are ignored. The guard runs the errors after every write; a review runs everything.

| Rule                    | Severity | Finds                                                                                                           |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `no-eval`               | error    | `eval`, `new Function`, strings passed to `setTimeout` or `setInterval`                                         |
| `no-unsafe-html`        | error    | `innerHTML` or `outerHTML` set to anything but an empty string, `insertAdjacentHTML`                            |
| `no-blocked-api`        | error    | `document.write`, Web Workers, service workers, `parseHTMLUnsafe`, `setHTMLUnsafe`                              |
| `no-legacy-global`      | error    | `$A`, `sforce`, `Sfdc`                                                                                          |
| `no-external-script`    | error    | `loadScript` or `loadStyle` with an `http(s)` URL; a `script` tag in a template                                 |
| `no-framework-endpoint` | error    | `fetch` or `open` on `/aura` or `/webruntime`                                                                   |
| `no-document-query`     | warning  | `document.querySelector` and its relatives                                                                      |
| `listener-cleanup`      | warning  | A listener on `window`, `document` or `globalThis` without a matching `removeEventListener`                     |
| `bind-in-listener`      | warning  | `addEventListener` with `.bind(...)` - impossible to remove                                                     |
| `resource-cleanup`      | warning  | `setInterval`, `requestAnimationFrame`, observers, `getUserMedia`, `subscribe` without the call that stops them |
| `event-name`            | warning  | Event names with capitals, hyphens or spaces, or starting with `on`                                             |
| `event-composed`        | warning  | `composed: true`                                                                                                |
| `event-base`            | warning  | `new Event(...)` instead of `CustomEvent`                                                                       |
| `no-pubsub`             | warning  | The deprecated `c/pubsub` module                                                                                |
| `schema-import`         | warning  | Field names as strings in `fields`, `optionalFields`, `getFieldValue`                                           |
| `track-primitive`       | warning  | `@track` on a primitive value                                                                                   |
| `api-reassign`          | warning  | Assignments to an `@api` property inside the component                                                          |
| `native-dialog`         | warning  | `alert`, `confirm`, `prompt`                                                                                    |
| `no-console`            | warning  | `console.log`, `debug`, `info`, `trace`, `dir`                                                                  |
| `hardcoded-id`          | warning  | String literals that look like record ids                                                                       |
| `hardcoded-url`         | warning  | `*.my.salesforce.com`, `*.lightning.force.com`, `*.my.site.com`                                                 |
| `navigation`            | warning  | Navigation by setting `location`                                                                                |
| `manual-dom`            | warning  | `appendChild` and similar while no element in the template has `lwc:dom="manual"`                               |
| `legacy-directive`      | warning  | `if:true`, `if:false`                                                                                           |
| `index-key`             | warning  | `key` set to the `for:index`                                                                                    |
| `img-alt`               | warning  | `img` without `alt`                                                                                             |
| `icon-button-label`     | warning  | `lightning-button-icon` without `alternative-text`                                                              |
| `click-only`            | warning  | `onclick` on `div`, `span`, `li`, `td` or `img` without a `role`, or on an `a` without `href`                   |
| `slds-override`         | warning  | CSS selectors on `.slds-*` classes                                                                              |
| `design-token`          | warning  | SLDS 1 design tokens (`--lwc-*`)                                                                                |
| `hardcoded-color`       | warning  | Hex, `rgb()` or `hsl()` colors outside a `var()` fallback                                                       |
| `important`             | warning  | `!important`                                                                                                    |
| `meta-api-version`      | warning  | `js-meta.xml` without `apiVersion`                                                                              |
| `meta-targets`          | warning  | Exposed without a target                                                                                        |
| `meta-label`            | warning  | Exposed without `masterLabel` and `description`                                                                 |
| `test-focused`          | warning  | `fit`, `fdescribe`, `xit`, `xdescribe`, `.only`, `.skip`                                                        |
| `test-cleanup`          | warning  | Components appended to `document.body` without an `afterEach`                                                   |
| `test-accessibility`    | info     | A test file without `toBeAccessible()`                                                                          |
| `bundle-test`           | info     | A component without `__tests__`                                                                                 |

The rules are deliberately simple patterns. A finding the team decided to keep gets a suppression with the reason - `// lwc-check-ignore <rule> -- <reason>` on the line or the line above (`<!-- -->` in templates, `/* */` in CSS); without a reason the suppression does not count. Suggest a suppression only when the user agrees with the reason.

## Review checklist

Ranked by how much harm each item does when it is wrong. After the tools, read every bundle in scope for:

1. **Security** - HTML or URLs built from data, Apex methods without `with sharing`, user mode, bind variables or allowlists, secrets in JavaScript, decisions the client makes that the server should ([security.md](security.md)).
2. **Wrong or stale data** - Apex and LDS for the same record, no refresh after an imperative write, changed wired data, handlers that assume order or run once, missing error and empty states, unchecked `errors` of a GraphQL result; Apex that only reads or writes what LDS or GraphQL would - a second cache and an endpoint to maintain ([data.md](data.md#graphql-before-apex)).
3. **Leaks** - what `connectedCallback` starts and `disconnectedCallback` does not stop; work in `renderedCallback` without a guard ([runtime.md](runtime.md#lifecycle)).
4. **Broken contracts** - `@api` properties changed inside, events with internal objects in `detail` or unnecessary `composed`, targets or properties in `js-meta.xml` that do not match the code, public API changes without a note about existing placements ([design.md](design.md#public-api)).
5. **Accessibility** - clickable elements that are not buttons or links, inputs without labels, meaning carried by color alone, missing `toBeAccessible()` ([styling-and-accessibility.md](styling-and-accessibility.md#accessibility)).
6. **Performance** - everything loaded at once, filtering or counting in the browser, expensive getters, libraries loaded on every render ([runtime.md](runtime.md#performance)).
7. **Styling** - SLDS overrides, fixed colors and SLDS 1 tokens, hand-built UI where a base component exists ([styling-and-accessibility.md](styling-and-accessibility.md#styling)).
8. **Tests** - behaviours without a test, failure paths that only assert a call, tests that depend on each other, skipped tests ([testing.md](testing.md)).
9. **Documentation and text** - README, JSDoc and metadata out of date; user-facing text that should be a Custom Label ([documentation.md](documentation.md)).

Report the findings ranked, each with file, line, why it matters and the fix - and whether a tool or the reading found it. End with what is already good.

## Diagnosing a broken component

Name the class before changing anything - each has a different place to fix.

| Symptom                                              | Usual causes                                                                                                                                                     | Look at                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Shows old values** after a save                    | Apex write without `notifyRecordUpdateAvailable`; wired Apex without `refreshApex`; Apex and LDS for one record                                                  | [data.md](data.md#keep-it-fresh)                                                |
| **Shows nothing**, no error                          | Wire handler only handles `data`; a reactive parameter stays `undefined`; `lwc:if` on a getter that never turns true; the user lacks access to a field or object | The wire handler, the parameters, the user's permissions                        |
| **"Cannot read properties of undefined"** on load    | Template or getter reads wired data before it arrived                                                                                                            | Guard getters with `?.` and a loading state                                     |
| **Endless re-rendering**, the page freezes           | State or a wire parameter changed in `renderedCallback`                                                                                                          | [runtime.md](runtime.md#lifecycle)                                              |
| **Event never arrives** at the parent                | Name with capitals or `on` prefix; listener on the wrong element; the event needs `bubbles` to pass a template level                                             | The `CustomEvent` and the `on...` attribute in the parent                       |
| **Works in Jest, fails in the org**                  | Base component stubs hide real behaviour; LWS distortion; CSP blocks a host; different API version                                                               | The browser console; the LWS Distortion Viewer; CSP Trusted Sites               |
| **A library fails to load** or throws                | Loaded from a URL; needs a blocked API; container without `lwc:dom="manual"`; loaded twice                                                                       | [runtime.md](runtime.md#third-party-libraries)                                  |
| **GraphQL error** - syntax or `VariableTypeMismatch` | A user value in the query string; one variable for fields of different types; a field that is not filterable in `where`                                          | [data.md](data.md#graphql) - and the query against the org's GraphQL endpoint   |
| **Apex error** in a toast                            | Missing class access or field permission under user mode; invalid identifier passed; query limit                                                                 | The Apex method, the user's permission sets, the debug log                      |
| **Slow** with real data                              | All records fetched; filtering in the browser; heavy getters; a list without keys                                                                                | [data.md](data.md#large-data), [runtime.md](runtime.md#performance)             |
| **Gets slower** the longer the page is open          | A listener, timer or observer that is never stopped                                                                                                              | `disconnectedCallback`; the checker's `listener-cleanup` and `resource-cleanup` |
| **Looks wrong** after a release or in dark mode      | SLDS overrides, fixed colors, SLDS 1 tokens, styling of base component internals                                                                                 | [styling-and-accessibility.md](styling-and-accessibility.md#styling)            |
| **Jest test fails** after a change                   | Missing `await` after a change; mock data shape changed; state left over from another test                                                                       | [testing.md](testing.md)                                                        |

Reproduce it in a Jest test where possible: it proves the cause, and stays as the guard against the bug coming back.
