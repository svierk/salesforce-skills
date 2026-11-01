---
name: salesforce-demo-designer
description: 'Designs and records polished demo videos of Salesforce orgs, Lightning apps and components, Experience Cloud sites and project documentation - scripted click paths with a visible cursor, captions, intro, chapter and outro cards, cross-fades, subtitles and an optional narration track - for bids, RFPs and sales pitches, sprint reviews, release teasers and social posts, training clips and README GIFs. TRIGGER when: planning or recording a demo video, screencast, teaser, walkthrough or GIF of a Salesforce org, an app, a component, a site or a docs page; turning user stories, release notes, a feature list or bid requirements into a demo storyboard; shortening, re-cutting, rebranding, translating or personalising a demo for another audience or prospect; adding captions, subtitles, chapters or a voice-over to a demo; writing the post or message that goes with a demo video. DO NOT TRIGGER when: writing automated UI tests - that is the E2E Automator; building or fixing the component that is shown - that is the LWC Crafter; building or fixing a React or Angular UI bundle or an embedded app that is shown - that is the Multi-Framework Wizard; building or fixing an HXL widget that an AI client shows - that is the HXL Hero; slide decks, or presenting a demo live without recording it; a single screenshot; editing camera footage or generating video with AI models.'
license: MIT
---

# Salesforce Demo Designer

Helps consultants, presales, developers and product owners show what they built - to a prospect in a bid, to stakeholders in a sprint review, to users in a training clip, to the community in a post. The result looks hand-edited but is fully scripted: a real browser session in a Salesforce org or on a site, a visible cursor with click ripples, captions that carry the message without sound, focus frames and camera zooms on what matters, branded intro, chapter and outro cards, frame-exact motion graphics (3D included), cross-fades, subtitles and chapter marks. Because the demo is a script, every variant - another prospect, another language, a square cut, next release's numbers - is a re-run, not a re-edit.

The toolbox is small and free: the installed Google Chrome driven by Playwright, Chrome's screencast for sharp frames, ffmpeg for encoding, and the Salesforce CLI for logging in. The skill ships the recorder as a library (`scripts/demo-kit.mjs`) and the cards as a template (`assets/cards.html`).

## Pick the format first

| Format                    | For                                            | Length         | Sound                                    | Shape                                                                  |
| ------------------------- | ---------------------------------------------- | -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **Teaser**                | Release news, social posts                     | 15-30 s        | Plays muted - captions carry the message | Intro card, 2-4 highlights, outro with the link                        |
| **Pitch walkthrough**     | Bids, RFPs, sales pitches, steering committees | 1-4 min        | Narration, or captions plus subtitles    | Intro for the prospect, one chapter per requirement, outro and contact |
| **Sprint review / story** | Stakeholders, product owners                   | 30-90 s        | Presenter talks over it, or captions     | Story card, click path along the acceptance criteria, result           |
| **Training clip**         | End users                                      | 30-90 s a task | Captions as numbered steps, subtitles    | Task card, one step per caption, result, tip                           |
| **README GIF**            | Docs and repositories                          | 5-15 s loop    | None                                     | No cards, one interaction, 960 px wide                                 |

The format sets the length, the cards and how much the captions must say - details in [references/storyboard.md](references/storyboard.md).

## Ground rules

1. **Demo data only.** Record in a sandbox, scratch org or developer org, or in a demo org the user confirms holds fictitious data only - `salesforceLogin` stops on a production org until then. Before the first take, look at everything that will be on screen: record names, emails, phone numbers, the logged-in user's name and photo, org banners. Hide or blur what must not appear, and use demo records rather than real ones.
2. **Keep the session out of sight.** The frontdoor URL from `sf org open --url-only` logs anyone in as that user. The library passes it straight to the browser - never print it, never put it in a file, never run `sf org open --url-only` where its output lands in the conversation.
3. **Every claim is true.** Captions and cards state facts - numbers, versions, "new", "one click". Take them from release notes, the org, the documentation or the user, never from memory, and ask when a number cannot be checked.
4. **Storyboard before recording.** Agree on scenes, captions and timing with the user as a table first. A storyboard change costs seconds; a take costs minutes.
5. **Probe before recording.** Screenshot every page of the path and try every selector in a throwaway script. Recording with a selector that does not match wastes a take.
6. **Look at every take.** Render a contact sheet and stills at the key moments and look at them before handing anything over - captions readable and not covering the subject, nothing private in frame, every beat visible long enough.
7. **Ask before changing an org.** Seeding demo data, a click path that creates or updates records, a new demo user, a change to an app's navigation, pausing automation - say what changes and wait for a yes. Prefer read-only click paths; when a demo must create records, plan their cleanup. A retake repeats every side effect - submissions, emails, applied actions: block, cut or reset (with a yes), never just record again.
8. **Prospect material stays private.** A video with a prospect's name or logo goes to that prospect only - never publish it, and use their logo only inside the bid.
9. **Recording is headed.** Say up front that a Chrome window opens while recording and must stay visible; the user should not work on the machine meanwhile. Headless Chrome crops and softens the frames.

## Workflow

1. **Brief.** Settle the format, audience, channel and aspect ratio, length, caption language, brand (colours, logo - or taken from the site or the customer's design tokens), what to show (stories, release notes, requirements of the bid), where it runs (org alias and page, or URL), what must not appear, and where the files go. Read release notes, documentation or the bid requirements yourself instead of asking for what is written down, and look at the org or site with a probe screenshot instead of asking how a page behaves. [references/storyboard.md](references/storyboard.md#the-brief)
2. **Storyboard.** Scenes with what happens on screen, the caption or narration, and seconds - totalled against the length. For a bid, one chapter per requirement, named with its ID. Agree it with the user. [references/storyboard.md](references/storyboard.md)
3. **Workspace.** A folder outside the user's repository with `playwright-core` and `ffmpeg-static`, the library and the cards copied in. [references/recording.md](references/recording.md#workspace)
4. **Probe.** For a Salesforce org: check it, log in, find the readiness element, the elements to click, and what to hide or blur. [references/salesforce.md](references/salesforce.md). For a site: screenshot it in light and dark, pick the scheme that suits the brand.
5. **Record.** Write `storyboard.mjs` with the library and run it; build generated scenes - intro, idents, concept diagrams, physical-to-digital bridges - as motion pages rendered frame by frame. [references/recording.md](references/recording.md#the-storyboard-script), [motion graphics](references/recording.md#motion-graphics)
6. **Review and iterate.** Contact sheet and stills for content, `smoothness()` and frame strips for motion; fix the cause, not the symptom, and record or re-render only what changed. Each change of the user's goes into the script, so the next take keeps it. [references/delivery.md](references/delivery.md#feedback-rounds)
7. **Deliver.** The MP4 where the user wants it, with subtitles and chapter marks; variants such as a square cut, a GIF or a narrated version; the post or cover message if wanted. Recorded live in front of an audience: a distinct file name, played right away, a rehearsal take as backup ([live demos](references/delivery.md#live-demos)). [references/delivery.md](references/delivery.md)

## The library at a glance

```js
import { launch, stage, salesforceLogin, ready, captureScene, captureCard, captureFrames, render, smoothness } from './demo-kit.mjs';

const browser = await launch(); // the installed Chrome, headed
const cards = await stage(browser, { width: 1600, height: 900, scale: 1.2, cursor: false }); // 1920x1080
const app = await stage(browser, { hide: ['devops_center-base-component'], blur: ['img.branding-user-profile'] });

await salesforceLogin(app, { org: 'demo', path: '/lightning/n/My_App_Page' });
await ready(app, app.page.getByText('Quote Builder'));

const scenes = [
  await captureCard(cards, 'intro', { scene: 'intro', seconds: 3, data: { title: 'Quotes in <em>one click</em>' } }),
  await captureScene(app, 'quote', async (d) => {
    await d.caption('Pick the products', { badge: 'NEW' });
    await d.click(d.page.getByRole('button', { name: 'Add products' }));
    await d.focus(d.page.getByRole('dialog')); // frames it while visible, follows it
    await d.zoom(d.page.getByRole('dialog'), { scale: 1.4 }); // camera move, applied when encoding
    await d.hold(1500);
  }),
  await captureFrames(cards, 'bridge', 'motion/bridge.html', { seconds: 6 }), // page with window.seek(t)
  await captureCard(cards, 'outro', { scene: 'outro', seconds: 3, data: { title: 'Ready for <em>Spring</em>' } })
];
await browser.close();
const video = await render(scenes, 'out/demo.mp4'); // cross-fades, writes out/demo.srt, returns chapter marks
console.log(await smoothness(video.file)); // single-frame blips and stalls - flicker you cannot see in stills
```

Every function, option and default is in [references/recording.md](references/recording.md#the-library).

## Alongside the other skills

This skill does its whole job on its own. When other skills from the same marketplace are installed too, the work splits like this:

- **LWC Crafter** - builds and fixes the component the demo shows. A demo of a new component needs it deployed to the demo org and placed on a page first; a bug found while recording goes back to the crafter, not into a workaround in the click path.
- **Multi-Framework Wizard** - builds and fixes the React and Angular UI bundles and the embedded apps a demo shows. A bundle opens from the App Launcher on its own `*.salesforce.app` domain; an app embedded on a Lightning page runs in a frame on another origin, so click paths into it go through Playwright's frame locators - probe them like any other selector. A demo that switches between surfaces can show the switch on purpose.
- **HXL Hero** - builds and fixes the widgets that Claude, ChatGPT or Slackbot render from the org's data. A demo of them records the client's page, signed in to the client and connected to the org first; the widget runs in a frame inside the client's page, so click paths into it go through frame locators. Ask the question once before recording, so the client has loaded the widget.
- **E2E Automator** - owns automated UI tests. A demo script is not a test: it may wait for effect, skip assertions and hide parts of the page. Do not turn one into the other.
- **DevOps Operator** - deploys to the demo org and commits the storyboard script, if the team keeps it in Git.

## Reference map

- [references/storyboard.md](references/storyboard.md) - the brief, formats and aspect ratios, timing, caption copy, visual language, structures for teaser, pitch, sprint review and training, bids and RFPs, narration
- [references/recording.md](references/recording.md) - workspace, the storyboard script, the library API, camera and focus, motion graphics (3D included), long demos, probing, what goes wrong and why
- [references/salesforce.md](references/salesforce.md) - login and org check, readiness, locators in Lightning, what to hide, personas and demo data, AI features, retakes and side effects, Lightning quirks, Experience Cloud
- [references/delivery.md](references/delivery.md) - review checklist, feedback rounds, variants, files, channels, posts and bid submissions
- [references/sources.md](references/sources.md) - where to read current facts about the tools
