# Sources

Where to read current facts about the tools, instead of relying on this skill or memory. Versions are whatever npm installs into the workspace; the lockfile pins them for the next run.

| Need                                                  | Source                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Current versions of the recorder's packages           | `npm view playwright-core version`, `npm view ffmpeg-static version`                                                  |
| Locators, `addInitScript`, keyboard and mouse         | https://playwright.dev/docs/locators, https://playwright.dev/docs/api/class-page                                      |
| Driving the installed Chrome (`channel: 'chrome'`)    | https://playwright.dev/docs/browsers                                                                                  |
| Chrome's screencast (`Page.startScreencast`)          | https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast                                   |
| ffmpeg concat demuxer, `xfade`, `palettegen`          | https://ffmpeg.org/ffmpeg-formats.html#concat-1, https://ffmpeg.org/ffmpeg-filters.html                               |
| `sf org open`, `sf data query`, `sf data import tree` | `sf org open --help`, `sf data query --help`, `sf data import tree --help` - the installed CLI's own help             |
| Lightning page types for apps, records, list views    | https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/components_navigation_page_definitions.htm |
| The demo org's tabs, list views and records           | The org itself - Tooling API and SOQL queries in [salesforce.md](salesforce.md#org-and-login)                         |

What the library does is in `scripts/demo-kit.mjs` - read it when a behaviour is unclear; it is short and commented.
