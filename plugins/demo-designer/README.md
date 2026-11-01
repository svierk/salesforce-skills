# 🎬 Demo Designer

Design and record polished demo videos of Salesforce orgs, Lightning apps and components, Experience Cloud sites and project documentation - without a screen recorder or a video editor.

For consultants, presales, developers and product owners who need to show what they built. The skill turns a brief into a storyboard, drives a real browser through the click path, and renders a video that looks hand-edited: a visible cursor with click ripples, captions that work without sound, branded intro, chapter and outro cards, cross-fades, subtitles and chapter marks. Because every demo is a script, the next prospect, language, aspect ratio or release is a re-run, not a re-edit.

## What it does

| Format                    | Example requests                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Teaser**                | "Make a 20-second teaser of what's new in our app for LinkedIn" · "Highlight release 1.3 of our docs site in a short video"      |
| **Pitch walkthrough**     | "Record a demo for the Acme bid covering requirements 4.1 to 4.5" · "Re-cut our quote demo for another prospect with their logo" |
| **Sprint review / story** | "Turn ABC-123 into a 60-second demo for the sprint review" · "Show the new approval flow along its acceptance criteria"          |
| **Training clip**         | "Make a training clip: how to create a quote, step by step, with subtitles"                                                      |
| **README GIF**            | "Add a GIF of the QR code component to the README"                                                                               |

- **Storyboard first** - scenes, captions and seconds as a table you agree on before anything is recorded, with timing rules that keep every beat readable.
- **Real click paths** - Playwright drives your installed Chrome through the org or site; Lightning base components are found by their labels, through shadow DOM.
- **Studio finish** - sharp 1080p frames from Chrome's screencast at an even 30 fps, an eased cursor, caption pills with badges, focus frames that follow their element, sub-pixel camera zooms, cards in your or your customer's brand, cross-fades, square and portrait cuts, GIFs, a narration track.
- **Motion graphics** - intros, chapter idents, concept diagrams and 3D scenes (three.js) as web pages, rendered frame by frame for exact timing.
- **Measured, not guessed** - a smoothness check finds single-frame flicker and judder that stills do not show.
- **Bid-ready** - one chapter per requirement, a personalised intro per prospect, subtitles and chapter marks for the submission.

## The recorder

The skill ships its recorder as a small library, `scripts/demo-kit.mjs`, and the cards as a template, `assets/cards.html`. A demo is a short script:

```js
const browser = await launch();
const app = await stage(browser, { blur: ['img.branding-user-profile'] });
await salesforceLogin(app, { org: 'demo', path: '/lightning/n/Quote_Builder' });

const scenes = [
  await captureCard(cards, 'intro', { scene: 'intro', data: { title: 'Quotes in <em>one click</em>' } }),
  await captureScene(app, 'quote', async (d) => {
    await d.caption('Pick the products', { badge: 'NEW' });
    await d.click(d.page.getByRole('button', { name: 'Add products' }));
    await d.hold(1500);
  })
];
await render(scenes, 'out/quote-demo.mp4'); // plus quote-demo.srt and chapter marks
```

## Guardrails

- Demos are recorded in sandboxes, scratch orgs and developer orgs - the login stops on a production org until you confirm it is a demo org with demo data only.
- The CLI's login URL is a live session: it goes straight to the browser and never into output, files or the conversation.
- Everything on screen is checked before hand-over: real names, emails, the logged-in user's photo and org banners are hidden or blurred, and every claim in a caption is taken from a source, not from memory.
- Seeding demo data or click paths that change records happen only after you say yes; personalised bid videos stay private.

## Alongside other skills

- [⚡ LWC Crafter](../lwc-crafter) builds and fixes the component a demo shows; a bug found while recording goes back there, not into a workaround in the click path.
- [🧙 Multi-Framework Wizard](../multi-framework-wizard) builds and fixes the React and Angular UI bundles and embedded apps a demo shows.
- [🦸 HXL Hero](../hxl-hero) builds and fixes the widgets that Claude, ChatGPT or Slackbot render; the demo records them in the client.
- [🧪 E2E Automator](../e2e-automator) owns automated UI tests - a demo script is not a test, and does not become one.
- [🧭 DevOps Operator](../devops-operator) deploys to the demo org and commits the storyboard script, if the team keeps it in Git.

## Requirements

- Node.js and npm
- Google Chrome - recording runs in a visible Chrome window, so the machine should stay free while a take records
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`), with the demo org authorised - for demos in Salesforce
- `playwright-core` and `ffmpeg-static` - installed by the skill into the demo's own workspace, not into your project

## Install

```text
/plugin marketplace add svierk/salesforce-skills
/plugin install demo-designer@salesforce-skills
```

In editors without the `/plugin` command, use the CLI: `claude plugin marketplace add svierk/salesforce-skills`, then `claude plugin install demo-designer@salesforce-skills`.
