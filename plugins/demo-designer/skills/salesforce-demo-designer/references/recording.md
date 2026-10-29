# Recording

How to set up a demo workspace, write the storyboard script, and what each part of the library does - plus the traps that cost earlier versions of this recorder their quality.

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
- For 3D motion graphics, `npm install three` as well - see [Motion graphics](#motion-graphics).

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

| Function                                                       | Does                                                                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `launch()`                                                     | Starts the installed Chrome, headed                                                                                                                                                                          |
| `stage(browser, options)`                                      | A browser context with the overlay; returns a director. Options: `width`, `height`, `scale` (default 1280x720 x 1.5), `colorScheme`, `theme`, `hide` and `blur` (CSS selectors), `cursor`                    |
| `salesforceLogin(director, { org, path })`                     | Checks the org, logs in through the frontdoor URL and opens `path`. Stops on production unless `allowProduction: true` - only after the user confirmed demo data only                                        |
| `ready(director, target, { settle })`                          | Waits until `target` is visible, then `settle` ms more                                                                                                                                                       |
| `captureScene(director, name, run, { chapter, quality })`      | Records what `run(director)` does to `out/<name>.mp4` at a constant 30 fps, with the camera moves of `zoom()` applied; returns the scene for `render`. `quality` is the screencast JPEG quality (default 90) |
| `captureCard(director, name, options)`                         | Renders a card frame by frame: `scene` (`intro`, `chapter`, `outro`), `data` for its slots, `seconds`, `cards` (path, default `cards.html`), `chapter`                                                       |
| `captureFrames(director, name, url, { seconds, fps, before })` | Renders a motion page frame by frame through its `window.seek(t)` - see [Motion graphics](#motion-graphics)                                                                                                  |
| `serve(root)`                                                  | Serves the workspace on localhost, so motion pages can load ES modules and seek videos; `captureFrames` calls it for workspace paths                                                                         |
| `render(scenes, out, { fade })`                                | Cross-fades the scenes into one MP4, writes `<out>.srt` from the captions, returns `{ file, duration, subtitles, chapters }`                                                                                 |
| `contactSheet(video, out, { duration, every })`                | One frame every `every` seconds in a grid - the whole take in one image                                                                                                                                      |
| `still(video, at, out)`                                        | One full-size frame                                                                                                                                                                                          |
| `smoothness(video)`                                            | Times of single-frame blips and single-frame stalls in motion - what viewers call flicker and judder; stills show neither                                                                                    |
| `gif(video, out, { width, fps, start, duration })`             | A GIF with its own palette                                                                                                                                                                                   |
| `addAudio(video, audio, out)`                                  | Lays a narration or music track under the video, padded or cut to its length                                                                                                                                 |

The director that `stage` returns, inside and outside scenes:

| Method                                      | Does                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moveTo(x, y, ms)`                          | Glides the cursor on an eased path in exactly `ms`                                                                                                                                           |
| `click(target, { ms, x, y })`               | Scrolls the element into view if needed, glides to it (`x`, `y` as fractions of its box), clicks                                                                                             |
| `type(text, { target, delay, clear })`      | Types like a person - into `target` after clicking it, or into the focused element; without a target it refuses when nothing editable has focus                                              |
| `press(key)`                                | One key, such as `Enter` or `Escape`; `End` and `Home` in a text input move the caret without a key event, so the page cannot scroll                                                         |
| `scrollTo(y, ms)`, `scrollToBottom(ms)`     | Eased page scroll                                                                                                                                                                            |
| `scrollToElement(target, { offset, ms })`   | Scrolls what really scrolls the element - its nearest scrollable ancestor (a page region, a modal body, a panel) or the window - until its top is `offset` pixels below that container's top |
| `focus(target, { pad })`, `unfocus()`       | Frames one or more elements in the theme's `focus` colour. The frame follows them while the page moves and shows only their visible part; `focus` throws when nothing of them is visible     |
| `zoom(target, { scale, ms, margin })`       | Camera move onto one or more elements, applied when the scene is encoded. The factor is capped so the whole target fits into `margin` (0.86) of the frame                                    |
| `zoomOut(ms)`                               | Back to the full frame. Scrolling and clicks outside the crop call it first, so the camera never hides the next action                                                                       |
| `caption(text, { badge })`, `caption(null)` | Shows or hides the caption; inside a scene it also becomes a subtitle                                                                                                                        |
| `hold(ms)`                                  | Waits on screen                                                                                                                                                                              |
| `page`, `mouse`, `size`                     | The Playwright page, the cursor position, the video size                                                                                                                                     |

`target` is a Playwright locator or a CSS selector. Prefer `getByRole`, `getByLabel` and `getByText` - they read what the viewer reads and pierce shadow DOM.

The `theme` of a stage restyles the overlay: `font`, `captionBg`, `captionText`, `captionBorder`, `accent` (badge background), `ripple` (click colour), `focus` (frame colour), `captionPosition` (`bottom` or `top`).

Captions are part of the page, so a zoom enlarges them too and can push them out of the crop. Zoom in beats without a caption, or set the caption after `zoomOut()`.

Cards: `cards.html` has three scenes with slots - `eyebrow`, `title` (`<em>` gets the accent gradient), `subtitle`, `chips`, `logo` on the intro; `eyebrow`, `title`, `subtitle` on a chapter; `image`, `eyebrow`, `title`, `stats` (`[{ value, label }]`), `cta`, `meta` on the outro. Empty slots disappear. `data.brand` sets `bg`, `surface`, `text`, `muted` and `accent` (three colours). Sizes are in `vmin`, so the same file fits every aspect ratio; restyle it freely for a brand, but keep `fill()`, `seek()`, `play()` and the rule that pauses animations until `play()`.

## Camera and focus

Zooms and focus frames make one element the clear subject of a moment. Used well they carry a pitch; used loosely they hide what matters.

- **One focus per moment.** Frame the element the caption or narration is about, hold, then `unfocus()` before the next subject.
- **Scroll first, then frame.** `focus` refuses an element that is clipped away - inside a dialog whose list ends early, behind a sticky footer, below the fold. Scroll it in with `scrollToElement`, or leave it out of the story.
- **Frame what reads together:** a heading with its paragraph, a row with its status - pass both elements, the frame covers them.
- **Zoom onto the result, not the journey.** Zoom after the page settled, hold, zoom out before the next action. The kit zooms out by itself before scrolling and before a click outside the crop.
- **Moderate factors.** 1.3-1.8 for a card or a table row. The cap keeps the whole target in frame; a target wider than the screen gets no zoom - frame it instead.
- **Fixed layouts that scale themselves** - flow builders, canvases, charts - often report element boxes that do not match what is drawn. Zoom onto their container there, without a frame.

## Motion graphics

Intros, chapter idents, concept diagrams and physical-to-digital bridges can be built as web pages and rendered with `captureFrames`. The page owns its timeline: it defines `window.seek(t)`, which sets everything to the state at `t` seconds; the kit calls it once per frame and takes a screenshot. That gives exact timing and no dropped frames, however heavy the page - unlike recording a page that animates in real time.

```html
<script>
  // CSS animations: pause them all and set their time
  window.seek = (t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t * 1000;
    }
    drawCustomParts(t); // anything driven by script, as a function of t
  };
</script>
```

- **Everything is a function of `t`.** No `requestAnimationFrame` loops, no `setTimeout`, no `Math.random()` - use a seeded generator, so every render of frame 120 is the same frame.
- **Assets first.** Set `window.motionReady = false` at the top and `true` once fonts, images and models are loaded; `captureFrames` waits for it.
- **3D with three.js** - for machines, products, a plant floor, a layered architecture. Serve the page (`captureFrames` does for workspace paths), import `three` through an import map pointing at `node_modules`, render in `seek(t)` with `preserveDrawingBuffer: true`. Studio lighting (`RoomEnvironment`), soft shadows, ACES tone mapping and a pixel ratio of about 1.5x the stage's scale for clean edges. Text that must stay crisp - labels, cards - is HTML on top, positioned by projecting 3D points to the screen each frame.
- **Videos inside a motion page** - a recap montage of earlier scenes, a screen on a device - seek each `<video>` in `seek(t)` and wait for `seeked`. Seek to the middle of a source frame, `(Math.floor(s * fps) + 0.5) / fps`, so a seek never flips between neighbouring frames, and do not scale the video by fractional amounts over time: a downscaled video re-sampled at a new size every frame shimmers.
- **Cut lengths in the storyboard.** A motion page renders at its full length; trim or hold in the edit, not by speeding the page up.

## Long demos

A pitch of several minutes is more than one `render` call. What held up:

- **One script per section**, recording its scenes into `out/`; an edit script per shot (length, overlays, speed) and an assembly script that joins the sections with idents between them. Re-record one section without touching the others.
- **Fit a take to its slot** by speeding up the whole take evenly (`setpts=PTS/<factor>` before `fps=30`) rather than cutting holds; keep the factor below about 2, or the cursor races.
- **Cut inside a take** only where the screen changes anyway - a page load, a dialog that opens - or with a short cross-fade (0.25 s); a jump cut on a static page reads as an error.
- **Chapter idents** between sections need about 2.5 s of readable hold, plus the wipe in and out.
- **Keep a log of feedback rounds** in the workspace: what was asked, what changed, what was learned. The next round, and the next demo, start from it.

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

| Symptom                                                    | Cause and fix                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Captions missing, bottom of the page cut off               | Headless Chrome crops about 90 pixels off every screencast frame and ignores the scale. `launch()` is headed for this reason; `captureScene` refuses cropped frames                                                                                                                                                                                                                   |
| Soft, blurry text                                          | Playwright's `recordVideo` encodes at a low bitrate; the library uses Chrome's screencast (JPEG frames with timestamps) instead. Small viewport with a scale above 1 for larger text                                                                                                                                                                                                  |
| Choppy or few frames                                       | The window was covered, minimised or the machine busy. Keep the Chrome window visible and do nothing else while recording; the library warns below 15 fps                                                                                                                                                                                                                             |
| Motion judders in a steady rhythm                          | Frames were timed through ffmpeg's concat demuxer, which rounds every timestamp to 1/25 s: merged frames and a frozen frame every few. The library builds a constant-rate frame sequence itself; keep it that way in your own edit scripts                                                                                                                                            |
| Hitches in fast scrolls                                    | Screencast JPEG quality near 100 makes Chrome skip frames under load. 90 is the default and looks the same after encoding                                                                                                                                                                                                                                                             |
| Text breathes and shimmers during a zoom                   | ffmpeg's `zoompan` rounds crop size and position to whole pixels each frame. The library zooms with `perspective` (sub-pixel, cubic); do the same in your own edit scripts                                                                                                                                                                                                            |
| A blue frame around nothing                                | The framed element was clipped - a dialog list that cannot scroll further, an element below the fold. `focus` now hides clipped parts and throws when nothing is visible; scroll first                                                                                                                                                                                                |
| Zoom cuts the subject off or hides the next click          | The factor was set by eye. `zoom` caps it to the target's size; scroll and click call `zoomOut` first                                                                                                                                                                                                                                                                                 |
| Scrolling does nothing, or the wrong part moves            | The element sits in a scrolling container - Lightning page regions, modal bodies. `scrollToElement` scrolls the nearest scrollable ancestor; synthetic wheel events land unevenly                                                                                                                                                                                                     |
| Cursor slower than planned                                 | Step-based mouse moves add one round trip per step. `moveTo` is time-based; keep it that way when you write helpers                                                                                                                                                                                                                                                                   |
| No cursor in the video                                     | Chrome's screencast does not draw the system cursor. The overlay draws one - it appears with the first mouse event, so move the mouse once before a scene starts                                                                                                                                                                                                                      |
| Scroll jumps or stutters                                   | The page sets `scroll-behavior: smooth`. The overlay turns it off; scroll with `scrollTo` and friends, not `element.scrollIntoView`                                                                                                                                                                                                                                                   |
| Scrollbar in frame                                         | Headed Chrome shows it; the overlay hides it with `scrollbar-width: none`                                                                                                                                                                                                                                                                                                             |
| Caption gone after a link                                  | A full page load is a new document. The overlay restores cursor and caption from session storage; set a new caption when the subject changes                                                                                                                                                                                                                                          |
| Card animations already over in the first frame            | They ran while the page loaded. `cards.html` pauses every animation; `captureCard` fills the card, waits for fonts and images, then sets the animations frame by frame through `seek()`                                                                                                                                                                                               |
| Last chip of the intro barely visible                      | Each chip starts 0.2 s after the previous one and takes 0.7 s. With three chips, hold the intro for at least 2.6 s, plus the fade                                                                                                                                                                                                                                                     |
| `xfade` error or wrong length                              | A scene shorter than the fade, or scenes of different sizes. Every stage of one video needs the same output size (viewport x scale)                                                                                                                                                                                                                                                   |
| Stale caption over the next page                           | `caption(null)` before navigating away                                                                                                                                                                                                                                                                                                                                                |
| The page jumps while typing, the text happens out of frame | A key went to the page: Chrome scrolls on `End`, `Home`, `PageDown` or `Space` when nothing editable has focus, and on `End`/`Home` in a text field whose caret already sits at that end. Use `press('End')` from the library (it moves the caret directly; `email` and `number` inputs fall back to the key) or click where the caret should go, and prefer `type(text, { target })` |
| Video starts on a loading page                             | Navigate and `ready()` before `captureScene`, not inside it                                                                                                                                                                                                                                                                                                                           |
