---
name: salesforce-prototype-pilot
description: 'Builds clickable web and mobile app prototypes on Salesforce-shaped mock data for pitches, bids and customer workshops - customer apps such as owner, member or patient apps, service portals and field companions - in the customer''s brand with official photography, typeface and logo, a side panel that shows the records and SOQL behind each screen, presenter shortcuts and deep links, verified with scripted screenshots, layout checks and click paths, and handed over as a repository with a preview image. TRIGGER when: someone asks for a clickable demo app, click dummy, prototype, mock-up app or showcase app for a customer, a pitch, a bid or a workshop; turning user stories, a concept paper or a screen sketch into a clickable app without an org; rebranding, extending or fixing such a prototype; adding a data panel, presenter features or a README preview to it. DO NOT TRIGGER when: building a real app on an org - a React or Angular UI bundle or an embedded app is the Multi-Framework Wizard, a Lightning web component is the LWC Crafter, an HXL widget is the HXL Hero; recording a demo video of a prototype or an org - that is the Demo Designer; slide decks or static design mock-ups; production apps.'
license: MIT
---

# Salesforce Prototype Pilot

Helps consultants, presales and architects put a customer-facing app in front of people before anything is built: a clickable prototype that runs in any browser and full screen on a phone, looks like the customer's brand, and shows - on the desktop, beside the phone - which Salesforce records, objects and queries sit behind each screen. The prototype carries the pitch; the panel carries the architecture story.

Everything starts from the [Salesforce Prototype Starter](https://github.com/svierk/salesforce-prototype-starter), a template repository with the whole shell: phone frame, navigation, deep links, data panel, presenter shortcuts, scripted chat replies, a Case lifecycle, PWA and full screen on phones. The work is brand, data and screens - not the shell. `scripts/proto-check.mjs` looks at the result through the installed Chrome: screenshots per screen, layout checks at several window sizes, click paths and the README preview.

## Ground rules

1. **Authentic brand assets, from the start.** Official photography of the real product, the customer's typeface and the exact logo make a prototype convincing; a drawing of the product makes it look silly and costs a full round. Find them in the brief, before the first screen. Until they arrive, the starter's labelled placeholders stay - visibly placeholders, never an illustration. [references/brand-assets.md](references/brand-assets.md)
2. **Settle rights in the brief.** Press photos usually allow editorial use only; corporate typefaces are licensed; a client's assets copied into a repository outside the client's organisation need the user's yes. Ask once, early, and record the answer in the README's brand assets table.
3. **Facts from sources.** Product data comes from the brand's press kit, product pages or a reference work - never from memory. Mark estimates with `*` on screen. Content you write for the demo (a manual chapter, a chat line) is labelled as demo content.
4. **Fictitious people, mock data.** Customers, advisors, IDs and serial numbers are invented; never real customer data, even in a private repository.
5. **An honest data panel.** It names only objects and APIs the real solution would use. When unsure, say "custom object" rather than inventing a standard one. [references/salesforce-mapping.md](references/salesforce-mapping.md)
6. **Look before handing over.** Run the checks and look at every screenshot yourself: layout at three window sizes, every deep link, the main click path. [references/checks.md](references/checks.md)
7. **Private unless neutral.** A prototype in a customer's brand lives in a private repository. Public hosting only for neutral material.
8. **Respect blocked sites.** When a brand site refuses automated fetches, use its press kit, media centre or a reference work instead - never a spoofed user agent or other workaround.

## Workflow

1. **Brief.** Audience and occasion (pitch, bid, workshop, steering committee), device (laptop with panel, phone in hand, both), UI language, the 3-5 jobs the app must show, brand assets, **their rights** (internal with the customer only? may licensed fonts go into the repository?), where the repository goes and with which settings, deadline. Ask in one message with a default for each. Read a concept paper, user stories or a screenshot the user provides instead of asking for what is written down. For assets, offer to find them yourself - press kit, media centre, the user's local client repositories - never offer to approximate the brand. [references/brief.md](references/brief.md)
2. **Research.** Product facts and assets in one pass: press kit for photos, rights line and headline figures; the user's local client repositories for fonts, logos and design tokens. [references/brand-assets.md](references/brand-assets.md)
3. **Start from the template.** `gh repo create <owner>/<name> --private --template svierk/salesforce-prototype-starter --clone`, then `npm install`. Copy settings such as description, wiki and merge options from the user's existing demo repositories when they name one. [references/build.md](references/build.md#start)
4. **Brand.** Tokens and font in `src/brand/theme.css`, names and image slots in `src/brand/brand.ts`, the official logo in `src/brand/Logo.tsx`, photos into `public/images/` - cropped to the subject, resized, credited. [references/brand-assets.md](references/brand-assets.md#preparing-images)
5. **Data.** Records in Salesforce shape in `src/data/records.ts` and `knowledge.ts`; the screen-to-record mapping for the panel in `src/data/inspector.ts`. [references/salesforce-mapping.md](references/salesforce-mapping.md)
6. **Screens.** Map each job to a tab or a screen; adapt the starter's screens first, write new ones from its patterns. UI text in the customer's language. Show the user the first screens early - a direction change is cheap then. [references/build.md](references/build.md#screens)
7. **Check.** `proto-check.mjs shots` for every deep link and three window sizes, `flow` for the main click path, then look at the images. Fix causes, re-run. [references/checks.md](references/checks.md)
8. **Deliver.** README with what it shows, a preview image (`proto-check.mjs preview`), how to run it, brand assets and rights, and the path to a real implementation; commit and push in the user's name. [references/delivery.md](references/delivery.md)

## Saving effort

- **Change brand, data and screens - not the shell.** Read only the starter files you change; the shell is tested and handles the desktop, phone and panel layout.
- **Use `proto-check.mjs`, not ad-hoc screenshot code.** It loads every deep link fresh, crops the phone at retina resolution and reports overlap, overflow and broken images in one run.
- **One research pass.** Collect photos, rights and figures from the press kit together; a second round for the same brand is a sign the first was too narrow.
- **Show early.** A screenshot of the first two screens after the brand step catches a wrong direction before the remaining screens copy it.

## The check script at a glance

```bash
S=<skill-dir>/scripts/proto-check.mjs
npm run dev -- --port 5173 &                     # the prototype must be running
node $S shots   --url http://localhost:5173 --views invite,home,asset/specs,advisor/chat --out shots
node $S flow    --url http://localhost:5173 --steps flow.json --out shots
node $S preview --url http://localhost:5173 --views invite,home,asset,guides,advisor/chat \
  --captions "Invitation,Home,Asset,Guides,Advisor" --title "Acme · Owner App" --logo logo.svg --out docs/preview.jpg
```

Options, the flow format and what each finding means are in [references/checks.md](references/checks.md).

## Alongside the other skills

This skill does its whole job on its own. When other skills from the same marketplace are installed too, the work splits like this:

- **Demo Designer** - records a video of the prototype: a teaser, a pitch walkthrough with captions, a README GIF. The deep links and the presenter reset make takes repeatable.
- **Multi-Framework Wizard** - when the prototype turns into a real app on an org: a React UI bundle on the same screens, with the panel's records becoming real queries.
- **LWC Crafter** - when a screen becomes a Lightning web component in Lightning Experience or an Experience Cloud site.
- **HXL Hero** - when the experience should appear inside Claude, ChatGPT or Slackbot as widgets on the org's data.
- **DevOps Operator** - commits and pull requests once the prototype lives in a team repository with a workflow.

## Reference map

- [references/brief.md](references/brief.md) - questions for the brief, turning jobs into screens, what to read instead of asking
- [references/brand-assets.md](references/brand-assets.md) - where photos, fonts and logos come from, rights, preparing images, logos built to the brand's geometry
- [references/salesforce-mapping.md](references/salesforce-mapping.md) - screen patterns and the objects and APIs behind them, by industry, and how to keep the panel honest
- [references/build.md](references/build.md) - the starter's structure, rebranding, adding and removing screens, patterns, deep links, language, running on a phone
- [references/checks.md](references/checks.md) - `proto-check.mjs` commands and options, the flow format, findings and their fixes, layout pitfalls, the visual review
- [references/delivery.md](references/delivery.md) - repository settings, README and preview, large images, hand-over, follow-ups
- [references/sources.md](references/sources.md) - where to read current facts
