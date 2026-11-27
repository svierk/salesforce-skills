# Sources

Where to read current facts, instead of relying on this skill or memory.

| Need                                                    | Source                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The starter's current structure, scripts and patterns   | https://github.com/svierk/salesforce-prototype-starter - its README and `src/`                                                 |
| Current versions of Vite, React, TypeScript             | `npm view vite version`, `npm view react version` - the starter's `package.json` pins what it was tested with                  |
| Standard and industry objects, fields                   | https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/ - or `sf sobject describe` in an org |
| Automotive Cloud objects (Vehicle, VehicleDefinition)   | https://developer.salesforce.com/docs - search "Automotive Cloud Developer Guide"                                              |
| Enhanced Messaging for In-App and Web                   | https://help.salesforce.com - search "Messaging for In-App and Web"                                                            |
| Experience Cloud headless identity (passwordless login) | https://help.salesforce.com - search "Headless Identity API"                                                                   |
| Salesforce Mobile SDK                                   | https://developer.salesforce.com/docs - search "Mobile SDK Development Guide"                                                  |
| Chrome DevTools protocol (screenshots, metrics, input)  | https://chromedevtools.github.io/devtools-protocol/                                                                            |
| CSS `zoom`, `font-stretch`, `minmax()`                  | https://developer.mozilla.org/docs/Web/CSS                                                                                     |
| Product facts and photos                                | The brand's press kit or media centre; image detail pages for the rights line                                                  |

What the check script does is in `scripts/proto-check.mjs` - read it when a behaviour is unclear; the header lists every command.
