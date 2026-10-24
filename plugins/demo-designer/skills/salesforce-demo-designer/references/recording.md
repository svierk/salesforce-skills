# Recording

How to set up a demo workspace, write the storyboard script, and what each part of the library does - plus the traps that cost the first versions of this recorder their quality.

## Workspace

A folder per demo, outside the user's repository - frames take hundreds of megabytes. Agree on the place; a scratch or temporary folder is fine when only the video matters, a kept folder when the demo will be re-run for the next prospect or release.

```bash
mkdir -p <workspace> && cd <workspace>
npm init -y && npm pkg set type=module
npm install playwright-core ffmpeg-static
npm approve-scripts ffmpeg-static            # npm 11 asks before install scripts; this one downloads ffmpeg
ls node_modules/ffmpeg-static/ffmpeg         # must exist - without it nothing encodes
cp <skill folder>/scripts/demo-kit.mjs <skill folder>/assets/cards.html .
```

- **`playwright-core`** drives the installed Google Chrome (`channel: 'chrome'`) - no browser download. Without Chrome, `npx playwright install chrome` installs it; ask first, it is a system change.
- **`ffmpeg-static`** brings an ffmpeg binary with H.264 (`libx264`) - no Homebrew, no system install. A system ffmpeg works too, but is not needed.
- Logos, pictures and narration go into the workspace next to `cards.html`; cards reference them by relative path.

Keep the storyboard script and the card data; delete `out/frames/` once the video is accepted.

## The storyboard script

One script per demo: stages, scenes in order, render, review artefacts. A complete one:

```js
// storyboard.mjs - QR Code Generator teaser, recorded in a developer org.
import { launch, stage, salesforceLogin, ready, captureScene, captureCard, render, contactSheet, still } from './demo-kit.mjs';

const browser = await launch();
const cards = await stage(browser, { width: 1600, height: 900, scale: 1.2, cursor: false });
const app = await stage(browser, { hide: ['devops_center-base-component'], blur: ['img.branding-user-profile'] });

const scenes = [];
scenes.push(
  await captureCard(cards, 'intro', {
    scene: 'intro',
    seconds: 3,
    chapter: 'Intro',
    data: { eyebrow: 'Awesome LWC Collection', title: 'QR codes,<br><em>right in Salesforce</em>', chips: ['Any URL', 'Optional logo', 'One click'] }
  })
);

// Log in and wait outside the scene - nobody wants to watch Lightning load.
await salesforceLogin(app, { org: 'awesome-lwc', path: '/lightning/n/Awesome_LWC_Collection' });
await ready(app, app.page.getByText('QR Code Generator').first());
await app.page.mouse.move(app.mouse.x, app.mouse.y); // show the cursor before the first frame

scenes.push(
  await captureScene(
    app,
    'generator',
    async (d) => {
      await d.caption('A Lightning web component on any app page', { badge: 'LWC' });
      await d.moveTo(900, 330, 1500);
      await d.hold(800);
      await d.caption('Paste any URL');
      await d.type('https://github.com/svierk/awesome-lwc-collection', { target: d.page.getByLabel('Target URL'), clear: true, delay: 35 });
      await d.click(d.page.getByRole('button', { name: 'Generate QR Code' }));
      await d.caption('One click - a scannable QR code');
      await d.scrollToElement(d.page.getByRole('button', { name: 'Generate QR Code' }), { offset: 40 });
      await d.hold(1800);
    },
    { chapter: 'Generate a QR code' }
  )
);

scenes.push(
  await captureCard(cards, 'outro', {
    scene: 'outro',
    seconds: 3,
    data: { eyebrow: 'Open source · MIT', title: 'More components in the <em>Awesome LWC Collection</em>', cta: 'github.com/svierk/awesome-lwc-collection' }
  })
);
await browser.close();

const video = await render(scenes, 'out/qr-teaser.mp4');
console.log(video.chapters.join('\n'));
await contactSheet(video.file, 'out/sheet.png', { duration: video.duration });
await still(video.file, 6, 'out/still-typing.png');
```

Run it with `node storyboard.mjs`. A 15-30 s demo records in about a minute.

## The library

| Function                                           | Does                                                                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launch()`                                         | Starts the installed Chrome, headed                                                                                                                                                       |
| `stage(browser, options)`                          | A browser context with the overlay; returns a director. Options: `width`, `height`, `scale` (default 1280x720 x 1.5), `colorScheme`, `theme`, `hide` and `blur` (CSS selectors), `cursor` |
| `salesforceLogin(director, { org, path })`         | Checks the org, logs in through the frontdoor URL and opens `path`. Stops on production unless `allowProduction: true` - only after the user confirmed demo data only                     |
| `ready(director, target, { settle })`              | Waits until `target` is visible, then `settle` ms more                                                                                                                                    |
| `captureScene(director, name, run, { chapter })`   | Records what `run(director)` does to `out/<name>.mp4`; returns the scene for `render`                                                                                                     |
| `captureCard(director, name, options)`             | Records a card: `scene` (`intro`, `chapter`, `outro`), `data` for its slots, `seconds`, `cards` (path, default `cards.html`), `chapter`                                                   |
| `render(scenes, out, { fade })`                    | Cross-fades the scenes into one MP4, writes `<out>.srt` from the captions, returns `{ file, duration, subtitles, chapters }`                                                              |
| `contactSheet(video, out, { duration, every })`    | One frame every `every` seconds in a grid - the whole take in one image                                                                                                                   |
| `still(video, at, out)`                            | One full-size frame                                                                                                                                                                       |
| `gif(video, out, { width, fps, start, duration })` | A GIF with its own palette                                                                                                                                                                |
| `addAudio(video, audio, out)`                      | Lays a narration or music track under the video, padded or cut to its length                                                                                                              |

The director that `stage` returns, inside and outside scenes:

| Method                                      | Does                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `moveTo(x, y, ms)`                          | Glides the cursor on an eased path in exactly `ms`                                               |
| `click(target, { ms, x, y })`               | Scrolls the element into view if needed, glides to it (`x`, `y` as fractions of its box), clicks |
| `type(text, { target, delay, clear })`      | Types like a person - into `target` after clicking it, or into the focused element               |
| `press(key)`                                | One key, such as `Enter` or `Escape`                                                             |
| `scrollTo(y, ms)`, `scrollToBottom(ms)`     | Eased page scroll                                                                                |
| `scrollToElement(target, { offset, ms })`   | Scrolls until the element's top is `offset` pixels below the viewport's top                      |
| `caption(text, { badge })`, `caption(null)` | Shows or hides the caption; inside a scene it also becomes a subtitle                            |
| `hold(ms)`                                  | Waits on screen                                                                                  |
| `page`, `mouse`, `size`                     | The Playwright page, the cursor position, the video size                                         |

`target` is a Playwright locator or a CSS selector. Prefer `getByRole`, `getByLabel` and `getByText` - they read what the viewer reads and pierce shadow DOM.

The `theme` of a stage restyles the overlay: `font`, `captionBg`, `captionText`, `captionBorder`, `accent` (badge background), `ripple` (click colour), `captionPosition` (`bottom` or `top`).

Cards: `cards.html` has three scenes with slots - `eyebrow`, `title` (`<em>` gets the accent gradient), `subtitle`, `chips`, `logo` on the intro; `eyebrow`, `title`, `subtitle` on a chapter; `image`, `eyebrow`, `title`, `stats` (`[{ value, label }]`), `cta`, `meta` on the outro. Empty slots disappear. `data.brand` sets `bg`, `surface`, `text`, `muted` and `accent` (three colours). Sizes are in `vmin`, so the same file fits every aspect ratio; restyle it freely for a brand, but keep `fill()`, `play()` and the rule that pauses animations until `play()`.

## Probing

Before the first take, a throwaway script against the same pages - screenshots to look at, and the facts the storyboard needs:

```js
import { launch, stage, ready } from './demo-kit.mjs';
const browser = await launch();
const d = await stage(browser);
await d.page.goto('https://example.com/docs/');
await d.page.screenshot({ path: 'probe-1.png' });
console.log(await d.page.getByRole('button', { name: 'Search' }).count()); // 1 = unique
console.log(await d.page.locator('.feature-grid').boundingBox()); // where to scroll
await browser.close();
```

Probe what a take depends on: that every locator matches exactly one element, the order of search results you will click, where long pages end, how long the slow parts take. Look at the screenshots - they also decide light or dark scheme, and what to hide.

## What goes wrong, and why

| Symptom                                         | Cause and fix                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Captions missing, bottom of the page cut off    | Headless Chrome crops about 90 pixels off every screencast frame and ignores the scale. `launch()` is headed for this reason; `captureScene` refuses cropped frames                  |
| Soft, blurry text                               | Playwright's `recordVideo` encodes at a low bitrate; the library uses Chrome's screencast (JPEG frames with timestamps) instead. Small viewport with a scale above 1 for larger text |
| Choppy or few frames                            | The window was covered, minimised or the machine busy. Keep the Chrome window visible and do nothing else while recording; the library warns below 15 fps                            |
| Cursor slower than planned                      | Step-based mouse moves add one round trip per step. `moveTo` is time-based; keep it that way when you write helpers                                                                  |
| No cursor in the video                          | Chrome's screencast does not draw the system cursor. The overlay draws one - it appears with the first mouse event, so move the mouse once before a scene starts                     |
| Scroll jumps or stutters                        | The page sets `scroll-behavior: smooth`. The overlay turns it off; scroll with `scrollTo` and friends, not `element.scrollIntoView`                                                  |
| Scrollbar in frame                              | Headed Chrome shows it; the overlay hides it with `scrollbar-width: none`                                                                                                            |
| Caption gone after a link                       | A full page load is a new document. The overlay restores cursor and caption from session storage; set a new caption when the subject changes                                         |
| Card animations already over in the first frame | They ran while the page loaded. `cards.html` pauses every animation until `play()`, which `captureCard` calls after fonts and images are loaded                                      |
| Last chip of the intro barely visible           | Each chip starts 0.2 s after the previous one and takes 0.7 s. With three chips, hold the intro for at least 2.6 s, plus the fade                                                    |
| `xfade` error or wrong length                   | A scene shorter than the fade, or scenes of different sizes. Every stage of one video needs the same output size (viewport x scale)                                                  |
| Stale caption over the next page                | `caption(null)` before navigating away                                                                                                                                               |
| Video starts on a loading page                  | Navigate and `ready()` before `captureScene`, not inside it                                                                                                                          |
