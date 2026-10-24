// Demo Kit - turns a scripted browser session into a polished demo video:
// a visible cursor with click ripples, captions, intro, chapter and outro
// cards, cross-fades, subtitles and chapter marks.
//
// Copy this file and ../assets/cards.html into a demo workspace that has
// playwright-core and ffmpeg-static installed; a storyboard script imports it.
// Both packages are loaded on first use, so the pure helpers below work
// without them.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
export const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/* ---------- Pure helpers ------------------------------------------------- */

/** Pixel size of the video a stage records: viewport times scale, even numbers for H.264. */
export function outputSize({ width, height, scale }) {
  const even = (n) => Math.round(n / 2) * 2;
  return { width: even(width * scale), height: even(height * scale) };
}

/**
 * ffmpeg concat-demuxer list that shows every frame from its own timestamp to
 * the next one, clipped to [start, end]. The screencast only sends a frame
 * when the page changes, so the durations carry the real timing - a static
 * page is one frame with a long duration. The last frame before `start` is
 * kept: it is what the page showed when the scene began.
 */
export function concatList(frames, start, end) {
  const kept = frames.filter((f, i) => {
    const next = frames[i + 1];
    return f.t < end && (f.t >= start || !next || next.t > start);
  });
  if (!kept.length) throw new Error('No frames were captured - the browser window must stay visible while recording.');
  let list = '';
  kept.forEach((f, i) => {
    const from = Math.max(f.t, start);
    const to = Math.min(kept[i + 1]?.t ?? end, end);
    list += `file '${f.file}'\nduration ${Math.max(0, to - from).toFixed(4)}\n`;
  });
  // The demuxer ignores the duration of the last entry unless the file is repeated.
  return `${list}file '${kept.at(-1).file}'\n`;
}

/** Where each scene starts in the joined video, when neighbours overlap by `fade` seconds. */
export function sceneOffsets(durations, fade) {
  const offsets = [0];
  for (let i = 1; i < durations.length; i++) offsets.push(offsets[i - 1] + durations[i - 1] - fade);
  return offsets;
}

/** Length of the joined video. */
export function totalDuration(durations, fade) {
  return durations.reduce((sum, d) => sum + d, 0) - fade * (durations.length - 1);
}

/** ffmpeg filter graph that cross-fades the inputs in order into the stream [v]. */
export function crossfadeGraph(durations, fade) {
  if (durations.length === 1) return '[0:v]format=yuv420p[v]';
  const short = durations.findIndex((d) => d <= fade);
  if (short >= 0)
    throw new Error(`Scene ${short + 1} is ${durations[short].toFixed(2)}s - shorter than the ${fade}s fade.`);
  const offsets = sceneOffsets(durations, fade);
  const steps = [];
  let previous = '[0:v]';
  for (let i = 1; i < durations.length; i++) {
    const last = i === durations.length - 1;
    const out = last ? '[v]' : `[x${i}]`;
    steps.push(
      `${previous}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offsets[i].toFixed(3)}${last ? ',format=yuv420p' : ''}${out}`
    );
    previous = out;
  }
  return steps.join(';');
}

/** Scene cues ({ start, end, text } relative to the scene) moved onto the joined timeline. */
export function joinCues(scenes, fade) {
  const offsets = sceneOffsets(
    scenes.map((s) => s.duration),
    fade
  );
  return scenes.flatMap((scene, i) =>
    scene.cues.map((cue) => ({ ...cue, start: cue.start + offsets[i], end: cue.end + offsets[i] }))
  );
}

/** Caption markup as subtitle text: tags dropped, the common entities decoded. */
export function plain(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, e) => entities[e])
    .replace(/\s+/g, ' ')
    .trim();
}

/** SubRip subtitles from cues in seconds. */
export function srt(cues) {
  const stamp = (seconds) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
}

/** Chapter marks ("0:00 Intro") for scenes that carry a `chapter` title. */
export function chapters(scenes, fade) {
  const offsets = sceneOffsets(
    scenes.map((s) => s.duration),
    fade
  );
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return scenes.flatMap((scene, i) => (scene.chapter ? [`${mmss(offsets[i])} ${scene.chapter}`] : []));
}

/* ---------- ffmpeg ------------------------------------------------------- */

async function ffmpeg(args) {
  const { default: bin } = await import('ffmpeg-static');
  execFileSync(bin, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

/* ---------- Browser ------------------------------------------------------ */

/**
 * Launches the installed Google Chrome. Headed on purpose: headless Chrome
 * crops the bottom of every screencast frame and ignores the device scale
 * factor, so captions disappear and text turns soft.
 */
export async function launch() {
  const { chromium } = await import('playwright-core');
  return chromium.launch({ channel: 'chrome', headless: false });
}

const DEFAULT_THEME = {
  font: 'Inter, "Segoe UI", system-ui, sans-serif',
  captionBg: 'rgba(11, 17, 32, 0.88)',
  captionText: '#ffffff',
  captionBorder: 'rgba(107, 155, 255, 0.4)',
  accent: 'linear-gradient(120deg, #5b21d6, #1d4ed8 50%, #00b8f0)',
  ripple: 'rgba(0, 200, 248, 0.45)',
  captionPosition: 'bottom'
};

// Runs inside every document of a stage: cursor, caption pill, hidden and
// blurred elements. Serialised by Playwright - no references to module scope.
function overlay({ theme, hide, blur, cursor }) {
  const store = {
    get: (key) => {
      try {
        return JSON.parse(sessionStorage.getItem(key));
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage blocked - the overlay still works within one document */
      }
    }
  };
  const css = `
    html { scrollbar-width: none; scroll-behavior: auto !important; }
    ${hide.length ? `${hide.join(', ')} { display: none !important; }` : ''}
    ${blur.length ? `${blur.join(', ')} { filter: blur(10px) !important; }` : ''}
    #__demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 30px; height: 30px;
      transform: translate(-100px, -100px); filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); display: ${cursor ? 'block' : 'none'}; }
    #__demo-cursor::after { content: ''; position: absolute; left: -16px; top: -16px; width: 32px; height: 32px;
      border-radius: 50%; background: ${theme.ripple}; transform: scale(0); opacity: 0; }
    #__demo-cursor.down::after { animation: __demo-ripple .45s ease-out; }
    @keyframes __demo-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
    #__demo-caption { position: fixed; left: 50%; ${theme.captionPosition === 'top' ? 'top' : 'bottom'}: 34px; z-index: 2147483646; pointer-events: none; display: flex;
      gap: 12px; align-items: center; padding: 11px 22px; border-radius: 999px; font: 600 21px/1.2 ${theme.font};
      color: ${theme.captionText}; background: ${theme.captionBg}; border: 1px solid ${theme.captionBorder};
      box-shadow: 0 12px 40px rgba(0,0,0,.35); backdrop-filter: blur(10px); white-space: nowrap; max-width: 92vw;
      opacity: 0; transform: translate(-50%, 16px); transition: opacity .35s ease, transform .35s cubic-bezier(.2,.8,.2,1); }
    #__demo-caption.badge { padding-left: 11px; }
    #__demo-caption.on { opacity: 1; transform: translate(-50%, 0); }
    #__demo-caption.instant { transition: none; }
    #__demo-caption b { font-size: 15px; font-weight: 700; letter-spacing: .06em; padding: 7px 12px; border-radius: 999px;
      color: #fff; background: ${theme.accent}; }`;
  const mount = () => {
    if (document.getElementById('__demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = css;
    const pointer = document.createElement('div');
    pointer.id = '__demo-cursor';
    pointer.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 3-1.3-2.9-6.5h6.3z"
      fill="#fff" stroke="#0b1120" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    const pill = document.createElement('div');
    pill.id = '__demo-caption';
    document.documentElement.append(style, pointer, pill);

    const place = ({ x, y }) => (pointer.style.transform = `translate(${x - 4}px, ${y - 2}px)`);
    addEventListener(
      'mousemove',
      (e) => {
        place({ x: e.clientX, y: e.clientY });
        store.set('__demo-mouse', { x: e.clientX, y: e.clientY });
      },
      true
    );
    addEventListener(
      'mousedown',
      () => {
        pointer.classList.remove('down');
        void pointer.offsetWidth;
        pointer.classList.add('down');
      },
      true
    );

    const show = (badge, text, instant) => {
      pill.classList.toggle('instant', !!instant);
      pill.classList.remove('on');
      store.set('__demo-caption', text ? { badge, text } : null);
      if (!text) return;
      const fill = () => {
        pill.innerHTML = `${badge ? `<b>${badge}</b>` : ''}<span>${text}</span>`;
        pill.classList.toggle('badge', !!badge);
        pill.classList.add('on');
      };
      if (instant || !pill.innerHTML) fill();
      else setTimeout(fill, 260);
    };
    window.__demo = { caption: show };

    // A full page load starts a new document: put cursor and caption back where they were.
    const mouse = store.get('__demo-mouse');
    if (mouse) place(mouse);
    const caption = store.get('__demo-caption');
    if (caption) show(caption.badge, caption.text, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}

/**
 * Opens a stage - one browser context with the overlay - and returns its
 * director. Defaults record 1280x720 CSS pixels at 1.5x: a 1920x1080 video
 * whose interface stays legible on a phone.
 */
export async function stage(
  browser,
  {
    width = 1280,
    height = 720,
    scale = 1.5,
    colorScheme = 'light',
    theme = {},
    hide = [],
    blur = [],
    cursor = true
  } = {}
) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme });
  await context.addInitScript(overlay, { theme: { ...DEFAULT_THEME, ...theme }, hide, blur, cursor });
  return new Director(await context.newPage(), { width, height, scale });
}

class Director {
  constructor(page, viewport) {
    this.page = page;
    this.viewport = viewport;
    this.size = outputSize(viewport);
    this.mouse = { x: viewport.width / 2, y: viewport.height / 2 };
    this.sceneStart = null;
    this.cues = [];
  }

  locate(target) {
    return typeof target === 'string' ? this.page.locator(target).first() : target;
  }

  /** Moves the cursor along an eased path; time-based, so it takes `ms` however slow each event is. */
  async moveTo(x, y, ms = 600) {
    const from = { ...this.mouse };
    const begin = Date.now();
    for (let p = 0; p < 1;) {
      await sleep(14);
      p = Math.min(1, (Date.now() - begin) / ms);
      const k = ease(p);
      await this.page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    }
    this.mouse = { x, y };
  }

  /** Glides to the element - scrolling it into view first if needed - and clicks it. */
  async click(target, { ms = 600, x = 0.5, y = 0.5 } = {}) {
    const element = this.locate(target);
    await element.waitFor({ state: 'visible' });
    let box = await element.boundingBox();
    if (box.y < 0 || box.y + box.height > this.viewport.height) {
      await this.scrollToElement(element);
      box = await element.boundingBox();
    }
    await this.moveTo(box.x + box.width * x, box.y + box.height * y, ms);
    await sleep(110);
    await this.page.mouse.down();
    await sleep(80);
    await this.page.mouse.up();
  }

  /** Types like a person - into the focused element, or into `target` after clicking it. */
  async type(text, { target, delay = 70, clear = false } = {}) {
    if (target) await this.click(target);
    if (clear) await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.type(text, { delay });
  }

  async press(key) {
    await this.page.keyboard.press(key);
  }

  /** Scrolls the page to `y` with an eased animation (CSS smooth scrolling has no fixed duration). */
  async scrollTo(y, ms = 1000) {
    await this.page.evaluate(
      ({ to, ms }) =>
        new Promise((done) => {
          const from = scrollY;
          const begin = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - begin) / ms);
            const k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            scrollTo(0, from + (to - from) * k);
            if (p < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        }),
      { to: y, ms }
    );
  }

  /** Scrolls so the element's top sits `offset` pixels below the top of the viewport. */
  async scrollToElement(target, { offset = 90, ms = 1000 } = {}) {
    const top = await this.locate(target).evaluate(
      (el, offset) => el.getBoundingClientRect().top + scrollY - offset,
      offset
    );
    await this.scrollTo(Math.max(0, top), ms);
  }

  async scrollToBottom(ms = 2400) {
    await this.scrollTo(await this.page.evaluate(() => document.documentElement.scrollHeight - innerHeight), ms);
  }

  /** Shows a caption - with an optional badge such as "NEW" or "v1.2" - or hides it with caption(null). */
  async caption(text, { badge } = {}) {
    const now = Date.now() / 1000;
    this.closeCue(now);
    if (text && this.sceneStart !== null) this.cues.push({ start: now - this.sceneStart, text: plain(text) });
    await this.page.evaluate(([b, t]) => window.__demo?.caption(b, t), [badge ?? null, text ?? null]);
  }

  closeCue(now) {
    if (this.sceneStart === null) return;
    const open = this.cues.at(-1);
    if (open && open.end === undefined) open.end = now - this.sceneStart;
  }

  async hold(ms) {
    await sleep(ms);
  }
}

/* ---------- Salesforce --------------------------------------------------- */

/**
 * Logs the stage into a Salesforce org through the CLI's frontdoor URL and
 * opens `path`. Stops on production orgs unless the user has confirmed the org
 * holds demo data only. The URL logs anyone in as this user, so it goes
 * straight to the browser and is never printed.
 */
export async function salesforceLogin(director, { org, path = '/lightning/page/home', allowProduction = false }) {
  const sf = (args) => {
    const out = execFileSync('sf', [...args, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out).result;
  };
  const target = org ? ['--target-org', org] : [];
  const [info] = sf([
    'data',
    'query',
    ...target,
    '--query',
    'SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization'
  ]).records;
  const safe = info.IsSandbox || info.TrialExpirationDate || info.OrganizationType === 'Developer Edition';
  if (!safe && !allowProduction) {
    throw new Error(
      `${org ?? 'The default org'} is a production org (${info.OrganizationType}). Record in a sandbox, scratch org or ` +
        'developer org - or, if it is a demo org with demo data only and the user confirmed that, pass allowProduction: true.'
    );
  }
  const { url } = sf(['org', 'open', ...target, '--url-only', '--path', path]);
  await director.page.goto(url);
}

/** Waits until `target` is visible, then lets the page settle - Lightning has no reliable "done" signal. */
export async function ready(director, target, { timeout = 60000, settle = 800 } = {}) {
  await director.locate(target).waitFor({ state: 'visible', timeout });
  await sleep(settle);
}

/* ---------- Recording ---------------------------------------------------- */

/**
 * Records one scene: everything `run(director)` does, as sharp frames from
 * Chrome's screencast with their real timestamps, encoded to <dir>/<name>.mp4
 * at a constant 30 fps. Returns what render() needs.
 */
export async function captureScene(director, name, run, { dir = 'out', chapter } = {}) {
  const { page, size } = director;
  await page.evaluate(() => window.__demo?.caption(null, null, true)).catch(() => {});
  director.cues = [];

  const framesDir = resolve(dir, 'frames', name);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const frames = [];
  let cropped = false;
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(join(framesDir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    if (metadata.deviceHeight < director.viewport.height - 2) cropped = true;
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: size.width, maxHeight: size.height });
  await sleep(150);

  const start = Date.now() / 1000;
  director.sceneStart = start;
  let end;
  try {
    await run(director);
  } finally {
    end = Date.now() / 1000;
    director.closeCue(end);
    director.sceneStart = null;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  if (cropped) throw new Error('Screencast frames are cropped - record with a headed browser (launch() does).');

  writeFileSync(join(framesDir, 'list.txt'), concatList(frames, start, end));
  const file = resolve(dir, `${name}.mp4`);
  await ffmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(framesDir, 'list.txt'),
    '-vf',
    `fps=30,scale=${size.width}:${size.height}:flags=lanczos,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '14',
    file
  ]);
  const duration = end - start;
  const fps = frames.length / duration;
  console.log(`${name}: ${duration.toFixed(2)}s, ${frames.length} frames (~${fps.toFixed(0)} fps)`);
  if (fps < 15)
    console.warn(`${name}: few frames - keep the Chrome window visible and the machine idle while recording.`);
  return { name, file, duration, size, cues: director.cues, chapter };
}

/**
 * Records a card from cards.html - intro, chapter or outro - filled with
 * `data`, holding it for `seconds`. Use a stage with cursor: false.
 */
export async function captureCard(
  director,
  name,
  { cards = 'cards.html', scene, data = {}, seconds = 3, dir, chapter }
) {
  await director.page.goto(`${pathToFileURL(resolve(cards)).href}?scene=${scene}`);
  await director.page.evaluate((d) => window.fill(d), data);
  await director.page.evaluate(() => document.fonts.ready);
  await director.page.waitForLoadState('networkidle');
  return captureScene(
    director,
    name,
    async () => {
      await director.page.evaluate(() => window.play());
      await sleep(seconds * 1000);
    },
    { dir, chapter }
  );
}

/**
 * Joins scenes with cross-fades into one MP4, and writes the captions as
 * <name>.srt next to it. Returns the length, the subtitles and chapter marks.
 */
export async function render(scenes, out, { fade = 0.45 } = {}) {
  const sizes = new Set(scenes.map((s) => `${s.size.width}x${s.size.height}`));
  if (sizes.size > 1)
    throw new Error(`Scenes differ in size (${[...sizes].join(', ')}) - give every stage the same output size.`);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const durations = scenes.map((s) => s.duration);
  await ffmpeg([
    ...scenes.flatMap((s) => ['-i', s.file]),
    '-filter_complex',
    crossfadeGraph(durations, fade),
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    resolve(out)
  ]);
  const cues = joinCues(scenes, fade);
  const subtitles = cues.length ? resolve(out).replace(/\.mp4$/i, '.srt') : null;
  if (subtitles) writeFileSync(subtitles, srt(cues));
  const duration = totalDuration(durations, fade);
  console.log(`${out}: ${duration.toFixed(1)}s`);
  return { file: resolve(out), duration, subtitles, chapters: chapters(scenes, fade) };
}

/* ---------- Review and delivery ------------------------------------------ */

/** One frame every `every` seconds, tiled into a single image to review a take at a glance. */
export async function contactSheet(video, out, { duration, every = 1, cols = 4, width = 640 }) {
  const rows = Math.ceil(duration / every / cols);
  await ffmpeg(['-i', video, '-vf', `fps=${1 / every},scale=${width}:-1,tile=${cols}x${rows}`, '-frames:v', '1', out]);
}

/** The frame at `at` seconds, full size. */
export async function still(video, at, out) {
  await ffmpeg(['-ss', String(at), '-i', video, '-frames:v', '1', out]);
}

/** A GIF with its own palette - for READMEs and docs, where video does not autoplay. */
export async function gif(video, out, { width = 960, fps = 12, start, duration } = {}) {
  await ffmpeg([
    ...(start !== undefined ? ['-ss', String(start)] : []),
    ...(duration !== undefined ? ['-t', String(duration)] : []),
    '-i',
    video,
    '-vf',
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    out
  ]);
}

/** Lays a narration or music track under the video; the audio is padded or cut to the video's length. */
export async function addAudio(video, audio, out) {
  await ffmpeg([
    '-i',
    video,
    '-i',
    audio,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-af',
    'apad',
    '-shortest',
    '-movflags',
    '+faststart',
    out
  ]);
}
