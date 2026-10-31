# Embedding

How an app gets onto a Lightning or Experience Cloud page as a microfrontend: a host LWC frames it with `lightning-ui-embedding`, passes props down and receives events up. Polyglot Arcade's `arcadeGameHost` frames both kinds of guest - the React cabinet from inside the org and the LWC OSS Snake from Vercel - and cannot tell them apart.

## Two kinds of guest

|                    | Internally hosted UI bundle                                                                              | Externally hosted app                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src`              | The bundle's full `*.salesforce.app` URL plus its embed route - the `StartUrl` of its App Launcher entry | Any HTTPS URL on an origin different from the org's                                     |
| Session            | The user's, established inside the frame through Salesforce's domains                                    | None - the guest has its own authentication or none                                     |
| Talks to the host  | The View SDK of `@salesforce/platform-sdk`                                                               | The View SDK if it can load the package, otherwise the package-free bridge              |
| Writes data        | Itself, through the Data SDK - pattern 3                                                                 | Through the host, which validates and saves - pattern 4                                 |
| Frameworks, status | Winter '27: beta, React only - check the release                                                         | Any framework; generally available since Winter '27 - check the release                 |
| Trust settings     | A CSP Trusted Site for `https://*.salesforce.app`, frame-src                                             | A CSP Trusted Site for the guest's origin, frame-src; the guest must allow being framed |

Org requirements at Winter '27: a Hyperforce org with English as the default language. `node <skill dir>/scripts/preflight.mjs` checks both.

Verified beyond the table: on API 68.0 (October 2026), a scratch org also framed the guest routes of Salesforce's Angular Recipes bundle from `/app/c__angularRecipes`. Until the guide lists Angular, treat it as unsupported - a design that depends on it names the risk in its decision record.

## The host LWC

A thin Lightning web component, generalised from `arcadeGameHost`:

```html
<template>
  <lightning-card title={title}>
    <template for:each={frames} for:item="frame">
      <lightning-ui-embedding
        key={frame.key}
        src={frame.src}
        sandbox="allow-scripts allow-same-origin allow-forms"
        shell-title={title}
        props={embedProps}
        ongameover={handleGameOver}
      ></lightning-ui-embedding>
    </template>
    <template lwc:if={errorMessage}>
      <div class="slds-notify slds-notify_alert slds-alert_error" role="alert">{errorMessage}</div>
    </template>
  </lightning-card>
</template>
```

```js
// src and sandbox are bound to the frame's session: render the frame in a keyed
// iteration, so a new URL mounts a new frame instead of changing the old one.
get frames() {
  return this.src ? [{ key: this.src, src: this.src }] : [];
}

// Every new props object is pushed to the guest as a fresh snapshot - rebuild it only when an input changes.
get embedProps() {
  const next = { view: this.view, recordId: this.recordId ?? null, objectApiName: this.objectApiName ?? null };
  const key = JSON.stringify(next);
  if (key !== this._propsKey) {
    this._propsKey = key;
    this._props = next;
  }
  return this._props;
}

// Lifecycle event names contain dots and cannot be bound in the template.
renderedCallback() {
  const frame = this.template.querySelector('lightning-ui-embedding');
  if (frame && frame !== this._wiredFrame) {
    this._wiredFrame = frame;
    frame.addEventListener('sf-embedding.component.error', (event) => this.handleEmbeddingError(event));
  }
}
```

- **`src` and `sandbox` are fixed at mount.** Changing either raises `SESSION_BINDING_MUTATED`. To show another URL, unmount and mount a new frame - the keyed iteration above, or an `lwc:if` around it.
- **Errors are shown, not swallowed.** `sf-embedding.component.error` carries `phase`, `code`, `message` and whether a retry can help. Show the code and message in the card; a blank frame with nothing in the console is the hardest bug of all. `sf-embedding.component.ready` tells when the guest is up.
- **Custom guest events bind declaratively** when their name has no dot (`ongameover`). Name them in lowercase without dots or hyphens.
- **Events to the guest** go the other way: `dispatchEvent(new CustomEvent('contactsdata', { detail }))` on the `lightning-ui-embedding` element (an `lwc:ref`) reaches the guest's View SDK listener. Use them for moments - a command such as "refresh now", data the host has just read - and props for state the guest needs at any time. An event sent before the guest listens is lost: the guest asks once it listens (Salesforce's GraphQL Data recipe dispatches `requestcontacts`), and the host answers and sends again when its data changes.
- **`src` comes from configuration** - the configuration record's App URL plus the embed path, joined by one tested function (`buildEmbedSrc` in the arcade). The function appends the route to the URL's path: a UI bundle lives under `/app/<namespace>__<name>`, so `url.pathname = '/embed'` drops that prefix and the frame loads a 404, reported as `HEARTBEAT_TIMEOUT` (X-ray `embed-src-replaces-path`). An `@api appUrl` property overrides it for local development. When nothing is configured, the card says how to fix it instead of showing an empty frame.
- **Record context as props.** On a record page, pass `recordId` and `objectApiName`; the guest attributes its results to that record.
- **`sandbox` with the tokens the guest needs** - the arcade uses `allow-scripts allow-same-origin allow-forms`; check the embedding guide for the release's defaults before widening it.
- **Properties for admins.** The host is the part App Builder sees: expose the view or item to show as a property with a `datasource` that lists the configured keys, and the targets the host makes sense on.
- **After a result:** a toast that says whether it reached Salesforce, then a Lightning Message Service message so other components refresh ([page fan-out](#page-fan-out)).
- **Jest:** `sfdx-lwc-jest` has no stub for `lightning-ui-embedding` at Winter '27. Map `^lightning/uiEmbedding$` to a stub that exposes `src`, `sandbox`, `shellTitle` and `props` as `@api` properties - the arcade's `jest-mocks/lightning/uiEmbedding/` - so tests can assert what the host passes.

## The guest with the SDK

```ts
// Registers the embedding bootstrap - handshake, auto-resize - before any view SDK call.
import '@salesforce/platform-sdk/ui-embedding';
import { getViewSDK } from '@salesforce/platform-sdk';

const sdk = await getViewSDK(); // an empty object off an embedding surface
const ui = sdk.getUiState?.();
if (ui) {
  applyProps(ui.state.props);
  const unsubscribe = ui.subscribe((next) => applyProps(next.props));
}
sdk.dispatchEvent?.(new CustomEvent('gameover', { detail, bubbles: true }));

// Events from the host arrive on the same SDK; remove the listener with the component.
sdk.addEventListener?.('contactsdata', (event) => showContacts(event.detail));
```

The arcade's cabinet uses `getViewSDK()`; the embedding guide of the same release shows `createViewSDK()` from `@salesforce/platform-sdk/view`. Read the installed package's exports before writing the call ([sources.md](sources.md#npm-packages)).

- **Feature-detect every call.** Off an embedding surface the SDK is empty, and the same code runs standalone.
- **Subscribe, don't read once.** Props change while the frame lives - the arcade switches games without a reload. Unsubscribe when the component goes away.
- **An embed route** (`/embed`): chromeless - no header bar, no own navigation - compact, sized by its content and not by the viewport, the view chosen by props. A class on the root element (`embedded`) lets the styles adapt. The platform's session banner shows inside every frame of a UI bundle too, above the embedded view; the switch for it ([ui-bundles.md](ui-bundles.md#anatomy)) affects the whole bundle, so decide it for standalone and embedded use together.
- **Event `detail` is plain data**, documented and typed on both sides. Include whether the guest's write reached Salesforce (`saved`), so the host does not claim success it cannot see.
- **The rest of the guide** - styling to match Salesforce, resizing, tracking unsaved changes, screen readers - is in the UI Embedding guide ([sources.md](sources.md#salesforce-documentation)).

## The guest without the SDK

The package-free bridge is for guests that cannot load `@salesforce/platform-sdk` - LWR and LWC OSS, stacks without npm, apps that will not take the dependency. The Snake's `embedding.js` implements it in about 250 lines of plain JavaScript:

```
host LWC (Salesforce)                          guest (in the frame)
    │  src ...?hostMetaData={hostAppOrigin, instanceId}
    │ ◄─────────────────── sf-embedding/ready (window message to hostAppOrigin only)
    │ ── sf-embedding.bootstrap + MessagePort ─────► checked: type and protocol, origin, source, instanceId, one port
    │                      JSON-RPC 2.0 over the port
    │ ── ui/notifications/host-initialized ───────►
    │ ◄─────────────── ui/notifications/embedding-initialized
    │ ◄─────────────── ui/subscribe/ui-state          (host props)
    │ ◄─────────────── ui/notifications/resize        (height of the content)
    │ ◄─────────────── ui/events/dispatch             (custom events)
```

- **Active only when framed** and the URL carries `hostMetaData`; opened on its own, the app behaves as before.
- **Trust only `hostAppOrigin`**, and only as a bare origin. Send the heartbeat to that exact origin, never `'*'`.
- **Run all checks on the bootstrap envelope** - type and protocol, `event.origin`, `event.source === window.parent`, the `instanceId`, exactly one port. A second valid envelope means nobody knows which port is genuine: send a shutdown and fail closed.
- **Keep the port in module scope**, never on `window`. Queue events raised before the handshake and send them once it is done. Answer requests the guest does not serve with JSON-RPC error `-32601`.
- **Report sanitized errors only** - a method, a category, a path - never messages or stacks.
- **Start from the Snake's module and its tests** rather than from scratch; the protocol specification linked from the guide is authoritative where they differ.

## Who saves

- **The guest with a session saves itself** (pattern 3): it writes through the Data SDK under the user's permissions and reports `saved` in its event. The host shows the outcome and fans it out.
- **The host saves for a guest without a session** (pattern 4), and treats every field as untrusted input:
  - only the fields it expects, with their types checked - the arcade accepts only whole, non-negative numbers;
  - attributed to what the host knows, not what the guest says - the arcade saves a round for the game record it embeds, whatever game key the guest reports, and takes the Account from the page;
  - written with `createRecord` or the GraphQL wire under the user's permissions, so sharing and field-level security apply;
  - the value itself is what the guest reports. For a score that is acceptable; for anything with money or consequences, the guest needs its own authentication and a server-side check.
- **The host reads for a guest without a session** the same way: it queries with Lightning Data Service or the GraphQL wire under the user's permissions and sends the result down as an event. Send only what the user may see and the guest needs to show - an externally hosted guest takes the data out of Salesforce.
- **Never hand a session, token or frontdoor URL to an external guest.** If a guest must read Salesforce data itself, it needs an integration of its own, designed and reviewed as one.

## Trust settings

All of these are org-wide security settings: show the exact metadata or setting, say what it opens, and wait for a yes (ground rule 10).

- **A CSP Trusted Site per guest origin** with only `isApplicableToFrameSrc` true and every other directive false, `context` All, the narrowest `endpointUrl` that works - `https://*.salesforce.app` for internal bundles, the guest's exact origin otherwise.
- **The guest must allow framing:** no `X-Frame-Options: DENY` or `SAMEORIGIN`, and a `frame-ancestors` that includes the org's domains if it sends one.
- **A different origin than the org** - a same-origin `src` fails with `SAME_ORIGIN_SRC`.
- **Experience Cloud hosts need more** at Winter '27: the Lightning domain and My Domain URL as frame-src trusted URLs, the site URL under Trusted Domains for Inline Frames with the UIEmbedding type, and "Require first-party use of Salesforce cookies" turned off in My Domain. The last one weakens a protection for the whole org - name that trade-off explicitly.
- **Development-only trusted sites** (`http://localhost:<port>`) live in their own source folder outside the package directories - the arcade's `dev/` - and are deployed on purpose to scratch and developer orgs only.

## Local development

1. Start the guest's dev server - the cabinet's Vite server, the Snake's `yarn dev`.
2. Deploy the development-only trusted site for it: `sf project deploy start --source-dir dev --target-org <scratch alias>`.
3. Set the host's **App URL** property on the page to the dev server.
4. If the frame stays empty with `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`, Chrome's Local Network Access blocks a public page from framing `localhost`: allow local network access for the org's domain in the site settings.

## Page fan-out

After a saved result the host publishes on a message channel - identifiers and a summary, not records - and every interested component on the page refreshes its own wired data:

```js
publish(this.messageContext, RESULT_CHANNEL, { itemKey, score });
```

Listeners subscribe in `connectedCallback`, unsubscribe in `disconnectedCallback`, and call `refresh()` on their wire result. Host and listeners know the channel, not each other: the arcade's leaderboard works next to any host, or none.
