# Data and security

The data model is the one contract every surface shares - LWC, React, Angular, external guests and agents. Get it right and the surfaces stay independent; get it wrong and every surface grows its own backend.

## The data model as contract

- **Ordinary Salesforce data, no custom backend.** Polyglot Arcade stores every finished round as an `Arcade_Score__c`. Leaderboards, high scores and play counts are queries, roll-up summaries and reports; sharing and field-level security decide who sees what, on every surface at once.
- **Every surface reads through the UI API.** UI bundles through the Data SDK's GraphQL, LWCs through Lightning Data Service and the GraphQL wire. The platform enforces object, field and record access the same way everywhere - there is no second place to secure.
- **The platform knows the user.** The player is the record's creator (`CreatedBy`); no surface sends a user id it could get wrong. The current user's name comes from `uiapi.currentUser`.
- **Name where data came from.** A picklist like the arcade's `Source__c` (`Polyglot Arcade`, `Pixel Cabinet`, `Embedded`) tells reports, support and the next architect which surface wrote a record.
- **Record context is a lookup.** A result produced on an Account page carries the Account (`Account__c`), so the record page, its related lists and its reports show it.
- **Describe the fields.** Labels and descriptions are read by admins, by codegen consumers and by agents choosing an action ([agentforce.md](agentforce.md#an-agent-on-the-same-data)). Write them for all three.
- **Apex only for what the UI API cannot do** - a transaction across objects with rules the client must not decide, an external callout, an aggregate GraphQL cannot express. Name the reason. An Apex REST endpoint called through `sdk.fetch` is a public endpoint: `with sharing`, user mode, bind variables, input allowlists - the LWC Crafter's security reference has the full list.

## Configuration records

One record per integrated item holds where it lives and how it integrates - the arcade's `Arcade_Game__c`:

| Field type     | Arcade field                                                     | Says                                                                  |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| External ID    | `Game_Key__c`                                                    | The key that ties the record to the bundle's registry and the host    |
| Picklist       | `Framework__c`                                                   | Which bundle or kind of guest it is                                   |
| URL            | `App_Url__c`                                                     | Where it lives - written per org by the setup, or shipped for a guest |
| Text           | `Embed_Path__c`                                                  | What Lightning frames, appended to the URL                            |
| Checkbox       | `Host_Saves_Score__c`                                            | The guest has no session; the host writes for it                      |
| Display fields | `Tagline__c`, `Accent_Color__c`, `Sort_Order__c`, `Is_Active__c` | What the entry point shows, in which order, and whether               |

The entry point builds its navigation from the records, the host builds its frame from them, and the pattern is derived from them. Adding an item is a record, a registry entry and - for a new origin - a trusted site.

## Access

- **One permission set per role** - the arcade's Polyglot Arcade Player - grants the apps (`applicationVisibilities`), read access to configuration, create and read on results, read on the context objects and the fields the surfaces query. Nothing more.
- **Results cannot be edited by the people who produce them.** Players create and read scores; they cannot edit or delete them.
- **The permission set is part of the feature.** A new field the bundle reads is a new field permission in the same change - otherwise the query fails for everyone but admins.
- **Reports and dashboards** run under each viewer's access too; users need the Run Reports permission, which standard profiles include.

## Seed data

- **Upsert by an external ID, never insert.** The arcade's data plan upserts games by `Game_Key__c` and the showcase Account by `Arcade_Key__c`. A second run updates the records in place, and the results that reference them survive.
- **Seed only configuration and showcase records**, never results or personal data. Showcase records are fictional and named so they are recognisable as such.
- **Org-specific values are not seed data.** The `*.salesforce.app` URLs differ per org and are written by the connect step after the deployment ([org-and-deploy.md](org-and-deploy.md#connect-step)).

## Trust boundaries

| Boundary                      | Rule                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guest → host (events, bridge) | Untrusted input. Accept known fields with checked types; attribute results to what the host knows - the configured item, the page's record       |
| Host → guest (props)          | Context only - identifiers, view names, settings. No session, token, frontdoor URL or data the guest has no right to                             |
| Window messages               | Sent to one exact origin, never `'*'`; received only after checking `event.origin` and `event.source`                                            |
| Framing                       | A trusted site per origin, frame-src only; no wildcards beyond `*.salesforce.app`; development origins never in a shared org                     |
| Org-wide settings             | Edge Network, first-party cookies, trusted domains for inline frames, session settings - shown with their trade-off and changed only after a yes |
| URLs                          | Nothing org-specific in code: `*.salesforce.app` URLs from `AppMenuItem.StartUrl` via the connect step, org URLs from `SFDC_ENV.orgUrl`          |
| Client-reported values        | A value computed in a browser is what the browser says. Fine for a game score; anything with consequences needs a server-side check              |
| Session banner                | Turned off only when the app itself shows who is logged in and offers a logout                                                                   |
