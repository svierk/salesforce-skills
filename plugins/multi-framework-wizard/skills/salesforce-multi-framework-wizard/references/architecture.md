# Architecture

How to decide which framework and surface does what, and how the surfaces connect. The shapes come from Polyglot Arcade and its decision records; the platform facts behind them are those of the release the arcade verified - check them for the org's release ([sources.md](sources.md)).

## Choosing a surface

| Surface                                   | Runs                                                                                                | Data and session                                                                  | Fits                                                                                                                      | Does not fit                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Lightning web component**               | Inside Lightning: record, app and home pages, Flow screens, utility bar, Experience Cloud LWR sites | The user's session; Lightning Data Service, the GraphQL wire, Apex                | Work on a record; components admins place and configure in App Builder; composing other surfaces on one page              | Big client-side apps with their own routing; teams that know React or Angular but not LWC |
| **Internal UI bundle** (React, Angular)   | Outside Lightning, on the org's `*.salesforce.app` domain, with its own App Launcher entry          | The user's session through the Data SDK: UI API GraphQL, REST through `sdk.fetch` | Apps with their own routes, rich client state, canvas or real-time loops; the npm ecosystem; a team's framework of choice | Being dragged onto a page in App Builder - it is framed through a host LWC instead        |
| **External UI bundle** (Experience Cloud) | An Experience Cloud site, for customers and partners                                                | Site users with their licenses                                                    | Portals and self-service apps for people outside the company                                                              | Packaging - check the release; employee workflows                                         |
| **Externally hosted app**                 | Anywhere on HTTPS, any framework - Vercel, a company's own hosting, LWC OSS on LWR                  | No Salesforce session; it reports results and a host LWC writes them              | Apps that exist already, apps another team owns, apps that must also run outside Salesforce                               | Anything that has to write Salesforce data itself without an authentication of its own    |
| **Agent**                                 | The Agentforce panel, the Conversation Client in a UI bundle, Slack, MCP clients                    | The agent's actions under its user's permissions                                  | Questions across data, guided tasks, summaries                                                                            | High-frequency or spatial interaction - a game loop, a drag-and-drop board                |

Go through these questions for every job the app must do, and stop at the first clear answer:

1. **Where do the users already work?** On a record in Lightning - bring it there, as an LWC or a framed app. In a dedicated workflow from the App Launcher - an internal UI bundle. Outside the company - Experience Cloud. Outside Salesforce - an external app.
2. **Does it belong to a record?** Then it is an LWC, or a framed app that gets the record id as a prop.
3. **Must admins place and configure it?** App Builder only knows Lightning web components. A framed app gets a host LWC with properties for admins.
4. **Is it a component or an app?** Routes, a session of work, client state, a canvas, a real-time loop: an app. A card, a list, a form on a record: a component.
5. **Does it exist already?** Frame it as an external app before rewriting it.
6. **Who builds and runs it?** The team's skills and ownership count as much as the technology. An Angular team builds Angular.

Use each framework where it fits, never to show it. Polyglot Arcade uses Angular for the app with routes and the lobby, React for the real-time games and as the one framework Lightning could frame from inside the org at the time, LWC for composition and the native leaderboard, and LWC OSS for a guest outside Salesforce.

## One role per surface

Polyglot Arcade's ADR 0001 gives every surface one role. The roles carry over to any domain:

| Role            | In the arcade                                 | In general                                                                                                        |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Entry point** | The Angular hub: the only lobby               | The one app users start from. It knows every other surface and launches it, wherever it lives.                    |
| **Machine**     | The React cabinet: games, no lobby of its own | A specialised app for one job. It is launched from the entry point; opening it directly sends the user there.     |
| **Floor**       | The Arcade Floor Lightning app                | Where microfrontends are composed: Lightning pages with host LWCs, next to native components on the same records. |
| **Guest**       | The Snake on Vercel                           | An app outside the org, framed on a page of the floor.                                                            |

- **One entry point.** Two apps that both look like the start confuse users; ADR 0001 removed the cabinet's lobby for that reason.
- **Composition happens in Lightning.** `lightning-ui-embedding` is an LWC base component, so a host is always a Lightning web component. At the arcade's release, the platform SDK only implemented the guest side - a UI bundle could not host another bundle by platform means. A hand-built `postMessage` contract between two bundles is possible but not supported: a spike, not an architecture. Check whether the release changed this.
- **A Lightning app for the floor.** Pages that belong to no app open in whatever app the user used last. Give the composed pages their own Lightning app, with a label different from the bundles' apps.
- **Make the switch visible.** A shared header bar with the same layout on every surface, a way back to the entry point, and the surface's name where it helps - the arcade's badge says "React · Pixel Cabinet UI bundle". A switch between surfaces should feel like a feature, not a break.

## Integration patterns

Polyglot Arcade names four patterns, under the same names in its docs, its running app and its host card. Use the same numbers when designing, so the diagram, the code and the conversation agree:

| #   | Pattern                                               | Use when                                                        | Who writes the data                                                  | Needs                                                                                                                       |
| --- | ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Native Angular UI bundle**                          | An Angular app launched from the App Launcher                   | The app, with the user's session, through the Data SDK               | The bundle, its app, a permission set                                                                                       |
| 2   | **Native React UI bundle**                            | The same in React                                               | The app, with the user's session, through the Data SDK               | The same                                                                                                                    |
| 3   | **Internally hosted microfrontend - the guest saves** | A bundle's view belongs on a Lightning or Experience Cloud page | The framed bundle, with the user's session; it tells the host it did | A host LWC, an embed route, the View SDK, a trusted site for `*.salesforce.app`; framework support and status per release   |
| 4   | **Externally hosted microfrontend - the host saves**  | An app outside Salesforce, any framework, belongs on a page     | The host LWC, after validating what the guest reports                | A host LWC, the View SDK or the package-free bridge in the guest, a trusted site for its origin, a page that allows framing |

Patterns 1 and 2 are one pattern - a native UI bundle - split by framework so the technology shows. In a business architecture, call it "native UI bundle" and name the framework. A bundle can offer patterns 2 and 3 at once: standalone routes and an embed route.

Agent touchpoints come on top - a conversation in a bundle, an agent on the same data, agent output as UI ([agentforce.md](agentforce.md)).

## Configuration as data

In Polyglot Arcade a game's record is its integration: `App_Url__c` says where it lives, `Embed_Path__c` what Lightning frames, `Host_Saves_Score__c` that the guest has no session, `Framework__c` which bundle it lives in. The lobby builds its cards from the records, the host builds its frame from them, and the hub's Tech X-ray derives the pattern from them - a new game is a record and a trusted site, not a code change.

- **One place per fact.** The arcade rejected a custom setting for the hub URL because the game records already held the other URLs. Two places for app URLs drift apart.
- **Org-specific values are written by the setup.** A bundle's `*.salesforce.app` URL differs per org; the setup's connect step reads it and stores it on the records ([org-and-deploy.md](org-and-deploy.md#connect-step)). Custom metadata suits configuration that is the same in every org and deployed with the code; records suit values the setup writes per org.
- **Derive, don't declare.** What can be computed from the configuration - the pattern, the embed URL, the link back - is computed in one function with tests, not written down per item.

## Navigation between surfaces

Verified in a Winter '27 scratch org (ADR 0001) - re-check on a new release:

| From → to          | How                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle → bundle    | Bundles share one origin, `https://<my-domain>--c.<...>.salesforce.app/app/<namespace>__<name>`. Derive the other bundle from `SFDC_ENV.basePath` and `SFDC_ENV.appName` instead of storing it.                                                   |
| Bundle → Lightning | `SFDC_ENV.orgUrl` plus `/lightning/app/<namespace>__<app>/n/<tab>` for a page, `/lightning/app/<namespace>__<app>/r/<Object>/<id>/view` for a record. Always name the app: `/lightning/n/<tab>` opens the tab in whatever app the user used last. |
| Lightning → bundle | The bundle's `*.salesforce.app` URL, which the org only exposes as the `StartUrl` of the app's `AppMenuItem`. An org-relative `/lightning/app/<namespace>__<bundle app>` opens an empty Lightning app instead.                                    |
| Bundle → logout    | `/secur/logout.jsp` - only needed when the bundle replaces the platform's session banner (`<meta name="sf-session-banner" content="disabled">`) with its own user display.                                                                        |

A hidden app cannot be launched: `applicationVisibilities` with `visible` false removes the access, not just the App Launcher entry. A machine that should not appear as a start point stays visible and redirects to the entry point instead.

## Communication

One job per channel. Polyglot Arcade has four, and most multi-framework apps need the same:

| Channel                      | Between                                 | Carries                                                                        |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| UI API - Data SDK, LDS, wire | Every surface → Salesforce data         | Records: configuration, the shared data, new results                           |
| Props                        | Host LWC → framed app                   | Context: which view, which record (`recordId`, `objectApiName`), settings      |
| Events                       | Framed app → host LWC                   | Intents and results: "a round ended, it was saved", "a record was selected"    |
| Lightning Message Service    | Host LWC → other components on the page | Notifications with identifiers - "this changed" - so others refresh their data |

- **Surfaces exchange intents and identifiers, never copies of data** that someone then writes a second time. Data goes through the UI API; channels say what happened.
- **Each side knows the channel, not the other side.** The arcade's leaderboard listens to a message channel and works next to any host, or none.
- **The contract is written down twice** - in the host and in the guest, with mirrored types and a comment that points to the other side (the cabinet's `GameOverDetail` is "mirrored by arcadeGameHost.handleGameOver").

## Diagrams

Mermaid code fences render on GitHub and on documentation sites alike. Polyglot Arcade's conventions:

- **One overview** (`flowchart LR`) with every surface, the guests and the data, and a diagram per pattern below it.
- **A sequence diagram per interaction that crosses a frame** - who sends what, in which order, until the data is saved and the page refreshed.
- **An ER diagram** for the data model.
- **One color per surface** through `classDef`, the same in every diagram and in the app itself; solid arrows carry data and events, dotted arrows are links a user follows.

`node <skill dir>/scripts/xray.mjs --mermaid` prints the project's surfaces as a starting point.

## Decision records

A decision that rules out an option gets an ADR in `docs/decisions/NNNN-<slug>.md`, in Polyglot Arcade's format:

```markdown
# NNNN - <Decision as a short sentence>

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Release:** <app version> (<issue>)

## Context

What hurts today, and the platform facts that limit the options - with the release they hold for.

## Decision

What each surface does now - a table when there are several. Navigation, configuration, what is shared.

## Verification

What was checked in which org and release before relying on it, and what came out.

## Consequences

What changes, what must now be kept in sync, what follows in a later release.

## Rejected options

- **<Option>.** Why not - a platform fact, a cost, or the problem it would bring back.
```

The Verification section is what makes an ADR about Multi-Framework worth keeping: the platform's behaviour at the time, observed rather than assumed.
