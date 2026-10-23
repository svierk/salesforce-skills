# Security

A Lightning web component runs inside three independent layers, and knowing which one stops something is the first step to fixing it:

| Layer                         | What it does                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Lightning Web Security (LWS)  | Sandboxes each namespace: blocks some browser APIs, changes others ("distortions"), wraps objects that cross namespaces |
| The LWC framework             | Shadow DOM, the lifecycle, no Aura globals (`$A`, `sforce`, `Sfdc`)                                                     |
| Content Security Policy (CSP) | Decides from which hosts scripts, styles, images, frames and connections may load                                       |

LWS is on by default in current orgs and replaces Lightning Locker. Its behaviour changes between releases: when an API acts strangely, check the LWS Distortion Viewer ([sources.md](sources.md#documentation)) before blaming the code.

## In the component

**Rendering**

- **No HTML strings in the DOM.** `innerHTML`, `outerHTML` and `insertAdjacentHTML` with anything that is not a constant are a cross-site scripting sink - and LWS does not sanitize inside the component's own shadow tree. Render with the template. For rich text from a trusted source, `lightning-formatted-rich-text`, which sanitizes.
- **Libraries that render HTML** (charts, org charts, editors) get escaped values. The collection's `orgChartViewer` escapes every value it puts into a node's HTML - do the same.
- **URLs from data** in `href`, `src` or an iframe: only `https:` (and relative paths) - a `javascript:` URL runs code. Admin-configured URLs in the App Builder are trusted configuration; URLs from records or users are not.

**Code**

- **No dynamic code** - `eval`, `new Function`, strings passed to `setTimeout` or `setInterval`. LWS sandboxes them instead of blocking them, so they run - and stay an injection risk. Use explicit logic or a lookup table; parse user-defined expressions with a parser for exactly the grammar you support.
- **Blocked APIs throw:** `document.write`, Web Workers, service workers, `parseHTMLUnsafe` and `setHTMLUnsafe`, and calls to the framework's own `/aura` and `/webruntime` endpoints. There is no workaround inside LWS - design without them.
- **No Aura or legacy globals.** `@salesforce/user/Id`, `lightning/uiRecordApi`, `lightning/navigation` and the other LWC modules replace them.

**Data in the browser**

- **Nothing secret in JavaScript.** Every line of a component is readable by every user who loads it - no API keys, tokens or passwords. Callouts go through Apex with Named Credentials.
- **`localStorage`, `sessionStorage` and cookies** are namespaced by LWS: a component sees only its own keys, and they are not a safe place for anything sensitive. Session and authentication state comes from the server.
- **Objects from another namespace** arrive wrapped in a proxy; changing them in place is silently lost. Clone, change the copy, send it back with an event. Event `detail` across namespaces should be plain, cloneable data.

**Loading code**

- **Libraries as static resources** loaded with `loadScript`, never from a CDN - see [runtime.md](runtime.md#third-party-libraries). A CSP Trusted Site for a script host weakens the whole org.
- **`postMessage`** with an iframe: name the target origin, and check `event.origin` on every message received.

## On the server

Everything about Apex as a public endpoint - `with sharing`, user mode, bind variables, allowlists, limits, errors for people - is in [data.md](data.md#apex). Two more rules:

- **Never trust what the client decides.** Ownership, prices, discounts, approvals, the id of "the current user" - the server derives them; it does not accept them as parameters.
- **Class access through permission sets** for the people who use the component, and only for them.

## Checks

| Tool                                              | Finds                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The guard and the checker of this skill           | Unsafe and blocked APIs, dynamic code, external scripts, Aura globals - errors that never ship      |
| ESLint with `@salesforce/eslint-config-lwc`       | `@lwc/lwc/no-inner-html`, `no-document-query`, `no-api-reassignments` and more, while typing        |
| Salesforce Code Analyzer (`sf code-analyzer run`) | Apex: missing CRUD and FLS checks, SOQL injection, sharing; JavaScript: vulnerable library versions |

A finding is fixed, or kept with a reason the user agreed to - never silenced to get green.
