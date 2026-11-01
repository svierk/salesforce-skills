# Org and deployment

What an org needs to run a multi-framework app, and how to get an app into it with one command that is safe to run again.

## Requirements

Winter '27's state - read the current list in the Multi-Framework guide's setup page and the embedding guide ([sources.md](sources.md#salesforce-documentation)):

| Requirement                                                                                                               | Without it                                         | Preflight check                       |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| Enterprise, Performance, Unlimited, Developer or Partner Developer Edition; not Government Cloud or Alibaba Cloud         | No Multi-Framework                                 | `UIBundle` metadata type              |
| A release with Multi-Framework, and with the features the design uses (Angular, embedding, packaging)                     | The deploy fails, or a pattern is not available    | API version, `UIBundle` metadata type |
| Hyperforce                                                                                                                | No Multi-Framework at all, and no embedding        | Instance name                         |
| The Salesforce Multi-Framework Apps domain enabled (Setup > Salesforce Multi-Framework Apps; needs Customize Application) | Internal apps have no `*.my.salesforce.app` domain | -                                     |
| Salesforce Edge Network (My Domain > Routing and Policies)                                                                | UI bundles do not open from the App Launcher       | `MyDomainSettings.useEdge`            |
| English as the default language                                                                                           | Embedded apps stay blank; standalone bundles work  | `Organization.LanguageLocaleKey`      |
| Digital Experiences and community licenses                                                                                | No external, site-based apps                       | -                                     |
| The Headless Experience Layer beta and Salesforce Hosted MCP servers, for a headless surface                              | No widgets in AI clients                           | The HXL Hero's preflight              |

## Preflight

```bash
node <skill dir>/scripts/preflight.mjs --target-org <alias> [--min-api <version>] [--json]
```

Read-only - two queries, a metadata type list and a retrieve of the My Domain settings into a temporary folder outside the project, so source tracking stays untouched. Every finding is a warning with a hint, never a blocker - except that a production org is named as one, and the skill does not deploy there. `--min-api` checks the API version against the release the design needs. The checks are heuristics where the platform offers no query: Hyperforce is read from the instance name. Polyglot Arcade runs the same checks as the first step of its setup (`scripts/preflight.mjs`).

## Scratch org definition

Polyglot Arcade's `config/project-scratch-def.json` sets what the features need, so a scratch org passes the preflight:

```json
{
  "edition": "Developer",
  "language": "en_US",
  "settings": {
    "myDomainSettings": { "useEdge": true }
  }
}
```

A headless surface needs `"uiWidgetSettings": { "hxlEnabled": true }` in the settings. An agent in the design needs Agentforce in the definition too - read the features and settings in the Agentforce DX guide for the release. Leave out `webAppOptIn` from older samples: Multi-Framework is on by default, and the setting now fails the settings deploy.

## One-command setup

A Salesforce DX project with UI bundles needs more than a deploy. Polyglot Arcade's `npm run setup -- --target-org <alias>`, derived from Salesforce's template script, runs in this order:

1. **Preflight** - warns about gaps, never blocks.
2. **Build** - `npm install` and `npm run build` in every bundle, so the build output exists.
3. **Deploy** - the metadata, including apps, permission sets, trusted sites, reports. With a headless surface, `Settings:UiWidget` goes first in a deploy of its own.
4. **Permission set** - assigned to the current user, configured in `scripts/org-setup.config.json`.
5. **Data** - configuration and showcase records upserted by external ID.
6. **Connect** - the org-specific bundle URLs stored on the configuration records; with a headless surface also the MCP server activated and its URL and OAuth client ID printed.
7. **GraphQL** - the org's schema downloaded and the types generated in every bundle.

**The first setup in an org has an order.** The permission set names the app, the app names the bundle, the bundle's build needs the operation types, and the types need a schema in which the user can already read the new fields - which the permission set grants. With the operation types committed, the build needs no org, and one deployment of fields, bundle, app and permission set goes through; then assign the permission set, seed, and fetch the schema for the next change.

What makes it a good setup, whatever the project:

- **It shows the steps and asks once** - Enter to run, `--yes` to skip the question in CI - and every step can be left out (`--skip-<step>`).
- **It is safe to run again** and keeps all data: upserts by external ID, deploys that replace, a connect step that overwrites the URLs.
- **It names the org on every command** (`--target-org`) and never changes the default org.
- **It stops on a production org** - add the org check of the preflight before the first change.
- **It waits for permission set groups.** A group recalculates after a deploy and cannot be assigned before its `Status` is `Updated` - poll `PermissionSetGroup` first, as Salesforce's recipes do in CI.

## Connect step

Internal bundle URLs are org-specific, and the org exposes them only as the start URL of the app's App Launcher entry. Polyglot Arcade's `scripts/connect.mjs` reads them and writes them onto the configuration records:

```bash
sf data query -q "SELECT Name, StartUrl FROM AppMenuItem WHERE Name IN ('pixelCabinet', 'polyglotArcade')" --target-org <alias> --json
sf data update record --sobject Arcade_Game__c --record-id <id> --values "App_Url__c='<start url>' Embed_Path__c='/embed'" --target-org <alias>
```

- Run it after every deploy of a new bundle and in every new org - a missing URL shows as a host that says "not plugged in yet" or a launch button without a target.
- An app that is not visible to the running user has no `AppMenuItem` row: assign the permission set first.
- Escape values that go into a query or a `--values` string; they come from the org, but the habit costs nothing.

## Upgrades

- **Salesforce's packages move together.** `@salesforce/platform-sdk`, `@salesforce/ui-bundle`, the Vite or Angular plugin and `@salesforce/graphiti` share one version number: raise them together in every bundle, each staying in `dependencies` or `devDependencies` where it is, and let the lockfile bring the embedding bridge along. Then run every bundle's checks and one round per integration pattern in a fresh scratch org - Polyglot Arcade's move from 11.x to 12.x needed no code change and was accepted that way.
- **The setup is the upgrade:** `git pull`, `npm install`, `npm run setup` - it deploys what is new and updates configuration in place.
- **Leftovers are removed by hand,** because a deploy does not delete: a renamed page, an old tab, a replaced host. Document each in an upgrade page with the exact command, and run it only after the user confirms - a delete in the org cannot be undone by a redeploy:

  ```bash
  sf project delete source --metadata CustomTab:<tab> --metadata FlexiPage:<page> --target-org <alias>
  ```

- References block deletes: a tab in another app's navigation or a profile has to be removed there first.

## Release acceptance

Polyglot Arcade's `scratch-org.yml` runs on release tags and on demand, so it does not use up the Dev Hub's scratch org limit on every push. It creates a scratch org with a JWT login to the Dev Hub, runs the setup, records a result, runs the setup again and checks that the configuration was updated and the result survived, then deletes the org. That one workflow proves the setup is repeatable - the property every later upgrade depends on. Each run holds one of the Dev Hub's active scratch orgs until it deletes the org - plan for the limit when people create scratch orgs from the same Dev Hub.

## Pipelines

A pipeline that deploys a project with UI bundles must install and build every bundle before `sf project deploy start`, run each bundle's lint, tests and build in its own job, and run the connect step after deploying to an org that gets a bundle for the first time. Hand this to the DevOps Builder if it is installed, together with the bundle folders and their npm scripts.
