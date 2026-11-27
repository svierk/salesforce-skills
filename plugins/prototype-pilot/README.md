# 🛩️ Prototype Pilot

Build clickable web and mobile app prototypes on Salesforce-shaped data - for pitches, bids and customer workshops - without an org and without starting from scratch.

For consultants, presales and architects who need to show a customer-facing app before anything is built: an owner or member app, a service portal, a field companion. The prototype runs in any browser and full screen on a phone, looks like the customer's brand with official photography, typeface and logo, and shows on the desktop - beside the phone - which Salesforce records, objects and queries sit behind each screen.

![Salesforce Prototype Starter: invitation, home, asset, guides and advisor chat](https://raw.githubusercontent.com/svierk/salesforce-prototype-starter/main/docs/preview.jpg)

## What it does

| Job                      | Example requests                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New prototype**        | "Build a clickable demo app for our premium car owners: vehicle data, owner's manual and a chat with their personal ambassador - for a pitch next week" |
| **From a concept**       | "Here is the concept PDF - turn it into a clickable mobile prototype and show which Salesforce objects each screen reads"                               |
| **Rebrand or translate** | "Make the same prototype for Acme in their brand and in French"                                                                                         |
| **Extend or fix**        | "Add an appointment booking to the prototype" · "The header overlaps the phone on my laptop"                                                            |
| **Hand-over**            | "Add a preview image to the README and push it to a private repository like our other demos"                                                            |

- **Starts from a template** - the [Salesforce Prototype Starter](https://github.com/svierk/salesforce-prototype-starter) brings the whole shell: phone frame, navigation, deep links, the data panel, presenter shortcuts, scripted chat replies, a Case lifecycle, PWA and full screen on phones. The work is brand, data and screens.
- **Authentic brand, early** - official press photography, the customer's typeface and the exact logo are settled in the brief, with their rights; labelled placeholders until they arrive, never a drawing of the product.
- **An honest architecture story** - each screen maps to the objects and APIs the real solution would use, by industry: Automotive Cloud, Service Cloud, Knowledge, Enhanced Messaging, Experience Cloud identity.
- **Checked, not hoped** - a script looks through Chrome at every deep link and three window sizes, finds overlaps, overflow and broken images, runs the main click path and composes the README preview.

## The check script

`scripts/proto-check.mjs` needs only Node.js and Google Chrome:

```bash
node proto-check.mjs shots   --url http://localhost:5173 --views invite,home,asset/specs,advisor/chat --out shots
node proto-check.mjs flow    --url http://localhost:5173 --steps flow.json
node proto-check.mjs preview --url http://localhost:5173 --views invite,home,asset,guides,advisor/chat \
  --captions "Invitation,Home,Asset,Guides,Advisor" --title "Acme · Owner App" --out docs/preview.jpg
```

## Guardrails

- Rights are settled in the brief: press photos are usually for editorial use, corporate typefaces are licensed, and a client's assets go into a repository outside the client's organisation only after you say yes.
- Product facts come from press kits and reference works, estimates are marked on screen, and demo content is labelled as such.
- People and records are fictitious; prototypes in a customer's brand live in private repositories.
- Sites that block automated access are not worked around - press kits and media centres are used instead.

## Alongside other skills

- [🎬 Demo Designer](../demo-designer) records a video or GIF of the prototype along its deep links.
- [🧙 Multi-Framework Wizard](../multi-framework-wizard) turns the prototype into a real React UI bundle on an org's data.
- [⚡ LWC Crafter](../lwc-crafter) builds a screen as a Lightning web component for Lightning Experience or Experience Cloud.
- [🦸 HXL Hero](../hxl-hero) brings the experience into Claude, ChatGPT or Slackbot as widgets.
- [🧭 DevOps Operator](../devops-operator) handles commits and pull requests once the prototype lives in a team repository.

## Requirements

- Node.js and npm
- Google Chrome - for the checks and the preview image (`CHROME_PATH` for another location)
- [GitHub CLI](https://cli.github.com) (`gh`) - to create the prototype from the template repository

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install prototype-pilot@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install prototype-pilot@salesforce-skills`.
