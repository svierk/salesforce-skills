// Demo Kit - turns a scripted browser session into a polished demo video:
// a visible cursor with click ripples, captions, focus frames, camera zooms,
// intro, chapter and outro cards, frame-exact motion graphics, cross-fades,
// subtitles and chapter marks.
//
// Copy this file and ../assets/cards.html into a demo workspace that has
// playwright-core and ffmpeg-static installed; a storyboard script imports it.
// Both packages are loaded on first use, so the pure helpers below work
// without them.

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
 * The screencast frame to show at each tick of a constant frame rate. Chrome
 * only sends a frame when the page changes, so each one stays on screen until
 * the next arrives; the last frame before `start` is what the page showed when
 * the scene began. Building the constant-rate sequence here - instead of
 * handing durations to ffmpeg's concat demuxer, which rounds every timestamp
 * to 1/25 s - keeps motion even: no merged frames, no frozen frame every few.
 */
export function frameSequence(frames, start, end, fps = 30) {
  const kept = frames.filter((f, i) => {
    const next = frames[i + 1];
    return f.t < end && (f.t >= start || !next || next.t > start);
  });
  if (!kept.length) throw new Error('No frames were captured - the browser window must stay visible while recording.');
  const out = [];
  let j = 0;
  const n = Math.max(1, Math.round((end - start) * fps));
  for (let k = 0; k < n; k++) {
    const t = start + k / fps;
    while (j + 1 < kept.length && kept[j + 1].t <= t + 1e-6) j++;
    out.push(kept[j].file);
  }
  return out;
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

/* ---------- Camera: pure helpers ----------------------------------------- */

/** The smallest box around all `rects` ({ x, y, width, height }). */
export function unionRect(rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Camera for a zoom onto `rect` (CSS pixels): the factor is capped so the
 * whole target fits into `margin` of the frame - a zoom that cuts its subject
 * off is worse than none - and the centre is moved so the crop stays inside
 * the page.
 */
export function fitZoom(rect, viewport, { scale = 1.6, margin = 0.86 } = {}) {
  const fit = Math.min((margin * viewport.width) / rect.width, (margin * viewport.height) / rect.height);
  const s = Math.max(1, Math.min(scale, fit));
  const halfW = viewport.width / s / 2;
  const halfH = viewport.height / s / 2;
  const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    scale: s,
    x: clampTo(rect.x + rect.width / 2, halfW, viewport.width - halfW),
    y: clampTo(rect.y + rect.height / 2, halfH, viewport.height - halfH)
  };
}

/** The part of the page a camera state shows, in CSS pixels. */
export function cropOf(cam, viewport) {
  const width = viewport.width / cam.scale;
  const height = viewport.height / cam.scale;
  return { x: cam.x - width / 2, y: cam.y - height / 2, width, height };
}

/**
 * Camera state at `t` seconds of a scene. `keys` are moves ({ t, ms, scale,
 * x, y }) recorded by zoom() and zoomOut(); between moves the camera holds,
 * during a move it eases from the previous state.
 */
export function cameraAt(keys, t, viewport) {
  let cam = { scale: 1, x: viewport.width / 2, y: viewport.height / 2 };
  for (const k of keys) {
    if (t < k.t) break;
    const p = Math.min(1, (t - k.t) / (k.ms / 1000));
    const e = ease(p);
    const to = { scale: k.scale, x: k.x, y: k.y };
    cam =
      p >= 1
        ? to
        : {
            scale: cam.scale + (to.scale - cam.scale) * e,
            x: cam.x + (to.x - cam.x) * e,
            y: cam.y + (to.y - cam.y) * e
          };
  }
  return cam;
}

/**
 * ffmpeg `perspective` filter that plays the camera moves on frames of the
 * given input size. It maps a sub-pixel crop rectangle onto the frame with
 * cubic interpolation, evaluated per frame. (zoompan rounds crop size and
 * position to whole pixels each frame, so text breathes and shimmers during a
 * zoom.) Returns '' when the scene has no moves.
 */
export function cameraFilter(keys, viewport, fps = 30) {
  if (!keys.length) return '';
  const T = `(in/${fps})`;
  const E = (p) => `if(lt(${p},0.5),4*pow(${p},3),1-pow(-2*(${p})+2,3)/2)`;
  const expr = (prop, initial) => {
    let out = String(keys.at(-1)[prop]);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const from = i === 0 ? initial : keys[i - 1][prop];
      const t0 = k.t.toFixed(3);
      const t1 = (k.t + k.ms / 1000).toFixed(3);
      const p = `((${T}-${t0})/${(k.ms / 1000).toFixed(3)})`;
      out = `if(lt(${T},${t0}),${from},if(lt(${T},${t1}),${from}+(${k[prop] - from})*${E(p)},${out}))`;
    }
    return out;
  };
  const z = `(${expr('scale', 1)})`;
  const cx = `(${expr('x', viewport.width / 2)})*W/${viewport.width}`;
  const cy = `(${expr('y', viewport.height / 2)})*H/${viewport.height}`;
  const x0 = `max(0,min(W-W/${z},${cx}-W/${z}/2))`;
  const y0 = `max(0,min(H-H/${z},${cy}-H/${z}/2))`;
  const x1 = `(${x0}+W/${z})`;
  const y2 = `(${y0}+H/${z})`;
  return `perspective=x0='${x0}':y0='${y0}':x1='${x1}':y1='${y0}':x2='${x0}':y2='${y2}':x3='${x1}':y3='${y2}':interpolation=cubic:sense=source:eval=frame`;
}

/* ---------- Smoothness: pure helpers ------------------------------------- */

/**
 * Single-frame flicker: frame i+1 differs from both neighbours while the
 * neighbours match each other (A-B-A). `d1[i]` is the mean difference between
 * frames i and i+1, `d2[i]` between frames i and i+2. Returns frame indices.
 */
export function findBlips(d1, d2, { threshold = 0.6, ratio = 0.35 } = {}) {
  const hits = [];
  for (let i = 0; i + 1 < d1.length && i < d2.length; i++) {
    if (d1[i] > threshold && d1[i + 1] > threshold && d2[i] < Math.min(d1[i], d1[i + 1]) * ratio) hits.push(i + 1);
  }
  return hits;
}

/** Single-frame stalls inside motion: a frame that repeats while the frames around it move. */
export function findStalls(d1, { moving = 0.4, still = 0.05 } = {}) {
  const hits = [];
  for (let i = 1; i + 1 < d1.length; i++)
    if (d1[i] < still && d1[i - 1] > moving && d1[i + 1] > moving) hits.push(i + 1);
  return hits;
}

/* ---------- ffmpeg ------------------------------------------------------- */

async function ffmpegBin() {
  const { default: bin } = await import('ffmpeg-static');
  return bin;
}

async function ffmpeg(args) {
  execFileSync(await ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit']
  });
}

/** Links (or, where links are not allowed, copies) the frames into a numbered sequence for ffmpeg's image2 input. */
function writeSequence(files, dir) {
  mkdirSync(dir, { recursive: true });
  files.forEach((file, k) => {
    const to = join(dir, `s${String(k).padStart(6, '0')}.jpg`);
    try {
      symlinkSync(file, to);
    } catch {
      copyFileSync(file, to);
    }
  });
  return join(dir, 's%06d.jpg');
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
  focus: '#1d4ed8',
  captionPosition: 'bottom'
};

// Runs inside every document of a stage: cursor, caption pill, focus frame,
// hidden and blurred elements. Serialised by Playwright - no references to
// module scope.
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
    html, * { scrollbar-width: none !important; scroll-behavior: auto !important; }
    ${hide.length ? `${hide.join(', ')} { display: none !important; }` : ''}
    ${blur.length ? `${blur.join(', ')} { filter: blur(10px) !important; }` : ''}
    #__demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 30px; height: 30px;
      transform: translate(-100px, -100px); filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); display: ${cursor ? 'block' : 'none'}; }
    #__demo-cursor::after { content: ''; position: absolute; left: -16px; top: -16px; width: 32px; height: 32px;
      border-radius: 50%; background: ${theme.ripple}; transform: scale(0); opacity: 0; }
    #__demo-cursor.down::after { animation: __demo-ripple .45s ease-out; }
    @keyframes __demo-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
    #__demo-focus { position: fixed; left: 0; top: 0; z-index: 2147483645; pointer-events: none; border: 3px solid ${theme.focus};
      border-radius: 6px; box-shadow: 0 0 0 4px color-mix(in srgb, ${theme.focus} 18%, transparent); opacity: 0; transition: opacity .25s ease; }
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
    const frame = document.createElement('div');
    frame.id = '__demo-focus';
    document.documentElement.append(style, frame, pointer, pill);

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

    // The focus frame follows its elements every animation frame (scrolling, late layout) and
    // shows only the part that is really visible: clipped by every scrolling or overflow-hidden
    // ancestor - across shadow roots - and by the viewport. Nothing visible, no frame.
    let targets = [];
    let pad = 6;
    let shown = null;
    const clipOf = (el) => {
      let r = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let n = el.parentElement || el.getRootNode().host; n; n = n.parentElement || n.getRootNode().host) {
        const cs = getComputedStyle(n);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
          const b = n.getBoundingClientRect();
          r = {
            left: Math.max(r.left, b.left),
            top: Math.max(r.top, b.top),
            right: Math.min(r.right, b.right),
            bottom: Math.min(r.bottom, b.bottom)
          };
        }
      }
      return r;
    };
    const visibleRect = () => {
      let box = null;
      for (const el of targets) {
        if (!el.isConnected) continue;
        const b = el.getBoundingClientRect();
        const c = clipOf(el);
        const r = {
          left: Math.max(b.left, c.left),
          top: Math.max(b.top, c.top),
          right: Math.min(b.right, c.right),
          bottom: Math.min(b.bottom, c.bottom)
        };
        if (r.right - r.left < 2 || r.bottom - r.top < 2) continue;
        box = box
          ? {
              left: Math.min(box.left, r.left),
              top: Math.min(box.top, r.top),
              right: Math.max(box.right, r.right),
              bottom: Math.max(box.bottom, r.bottom)
            }
          : r;
      }
      return box;
    };
    const track = () => {
      const r = targets.length ? visibleRect() : null;
      if (r) {
        const to = { x: r.left - pad, y: r.top - pad, w: r.right - r.left + 2 * pad, h: r.bottom - r.top + 2 * pad };
        // glide when moving between elements, follow exactly otherwise
        shown = shown
          ? {
              x: shown.x + (to.x - shown.x) * 0.35,
              y: shown.y + (to.y - shown.y) * 0.35,
              w: shown.w + (to.w - shown.w) * 0.35,
              h: shown.h + (to.h - shown.h) * 0.35
            }
          : to;
        Object.assign(frame.style, {
          transform: `translate(${shown.x}px, ${shown.y}px)`,
          width: `${shown.w}px`,
          height: `${shown.h}px`,
          opacity: 1
        });
      } else frame.style.opacity = 0;
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
    const focus = (els, p = 6) => {
      targets = els || [];
      pad = p;
      if (!targets.length) shown = null;
    };
    const visible = () => !!visibleRect();
    window.__demo = { caption: show, focus, visible };

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
    this.camera = [];
    this.cam = { scale: 1, x: viewport.width / 2, y: viewport.height / 2 };
  }

  locate(target) {
    return typeof target === 'string' ? this.page.locator(target).first() : target;
  }

  now() {
    return Date.now() / 1000 - (this.sceneStart ?? Date.now() / 1000);
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

  /**
   * Glides to the element - scrolling it into view first if needed - and clicks it.
   * While zoomed, the camera first pulls back when the element lies outside the crop.
   */
  async click(target, { ms = 600, x = 0.5, y = 0.5 } = {}) {
    const element = this.locate(target);
    await element.waitFor({ state: 'visible' });
    let box = await element.boundingBox();
    if (box.y < 0 || box.y + box.height > this.viewport.height) {
      await this.scrollToElement(element);
      box = await element.boundingBox();
    }
    const px = box.x + box.width * x;
    const py = box.y + box.height * y;
    if (this.cam.scale > 1) {
      const c = cropOf(this.cam, this.viewport);
      if (px < c.x || px > c.x + c.width || py < c.y || py > c.y + c.height) await this.zoomOut();
    }
    await this.moveTo(px, py, ms);
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
    if (this.cam.scale > 1) await this.zoomOut();
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

  /**
   * Scrolls so the element's top sits `offset` pixels below the top of what scrolls it: the
   * nearest scrollable ancestor - a Lightning page region, a modal body, a panel - or the
   * window. Eased, in the page, frame by frame; synthetic wheel steps land unevenly.
   */
  async scrollToElement(target, { offset = 90, ms = 1000 } = {}) {
    if (this.cam.scale > 1) await this.zoomOut();
    await this.locate(target).evaluate(
      (el, { offset, ms }) =>
        new Promise((done) => {
          let box = null;
          for (let n = el.parentElement || el.getRootNode().host; n; n = n.parentElement || n.getRootNode().host) {
            const cs = getComputedStyle(n);
            if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
              box = n;
              break;
            }
          }
          const top = el.getBoundingClientRect().top;
          const from = box ? box.scrollTop : scrollY;
          const base = box ? box.getBoundingClientRect().top : 0;
          const max = box ? box.scrollHeight - box.clientHeight : document.documentElement.scrollHeight - innerHeight;
          const to = Math.max(0, Math.min(max, from + top - base - offset));
          const begin = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - begin) / ms);
            const k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            if (box) box.scrollTop = from + (to - from) * k;
            else scrollTo(0, from + (to - from) * k);
            if (p < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        }),
      { offset, ms }
    );
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

  /**
   * Frames one or more elements with the theme's focus colour - one clear focus per moment.
   * The frame follows them while the page moves and hides wherever they are clipped from view,
   * so it never frames something the viewer cannot see. Throws if nothing of them is visible.
   */
  async focus(target, { pad = 6 } = {}) {
    const elements = await Promise.all([target].flat().map((t) => this.locate(t).elementHandle()));
    await this.page.evaluate(([els, p]) => window.__demo?.focus(els, p), [elements, pad]);
    await sleep(60);
    if (!(await this.page.evaluate(() => window.__demo?.visible()))) {
      await this.unfocus();
      throw new Error('focus(): the target is not visible - scroll it into view (scrollToElement) first.');
    }
  }

  async unfocus() {
    await this.page.evaluate(() => window.__demo?.focus(null));
  }

  /**
   * Zooms the camera onto one or more elements, applied when the scene is encoded. The factor
   * is capped so the whole target stays in frame. Captions belong to the page and zoom with
   * it: zoom in caption-free beats or caption after zoomOut().
   */
  async zoom(target, { scale = 1.6, ms = 900, margin = 0.86 } = {}) {
    if (this.sceneStart === null) throw new Error('zoom() works inside captureScene only.');
    const boxes = await Promise.all([target].flat().map((t) => this.locate(t).boundingBox()));
    const cam = fitZoom(unionRect(boxes.filter(Boolean)), this.viewport, { scale, margin });
    this.camera.push({ t: this.now(), ms, ...cam });
    this.cam = cam;
    await sleep(ms);
  }

  /** Back to the full frame. scrollTo, scrollToElement and clicks outside the crop call it themselves. */
  async zoomOut(ms = 700) {
    if (this.cam.scale === 1 || this.sceneStart === null) return;
    const cam = { scale: 1, x: this.viewport.width / 2, y: this.viewport.height / 2 };
    this.camera.push({ t: this.now(), ms, ...cam });
    this.cam = cam;
    await sleep(ms);
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
 * Chrome's screencast with their real timestamps, resampled to a constant
 * 30 fps, with the camera moves of zoom() applied, encoded to <dir>/<name>.mp4.
 * Returns what render() needs. JPEG quality above ~90 makes Chrome drop frames
 * during fast scrolls; 90 looks the same after encoding.
 */
export async function captureScene(director, name, run, { dir = 'out', chapter, quality = 90 } = {}) {
  const { page, size, viewport } = director;
  await page.evaluate(() => window.__demo?.caption(null, null, true)).catch(() => {});
  director.cues = [];
  director.camera = [];
  director.cam = { scale: 1, x: viewport.width / 2, y: viewport.height / 2 };

  const framesDir = resolve(dir, 'frames', name);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const frames = [];
  let cropped = false;
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(framesDir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    if (metadata.deviceHeight < viewport.height - 2) cropped = true;
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: size.width, maxHeight: size.height });
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
    await page.evaluate(() => window.__demo?.focus(null)).catch(() => {});
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  if (cropped) throw new Error('Screencast frames are cropped - record with a headed browser (launch() does).');

  const input = writeSequence(frameSequence(frames, start, end, 30), join(framesDir, 'seq'));
  const file = resolve(dir, `${name}.mp4`);
  const camera = cameraFilter(director.camera, viewport, 30);
  const vf = [camera, `scale=${size.width}:${size.height}:flags=lanczos`, 'format=yuv420p'].filter(Boolean).join(',');
  await ffmpeg(['-framerate', '30', '-i', input, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', file]);
  const duration = end - start;
  const fps = frames.length / duration;
  console.log(`${name}: ${duration.toFixed(2)}s, ${frames.length} frames (~${fps.toFixed(0)} fps)`);
  if (fps < 15)
    console.warn(`${name}: few frames - keep the Chrome window visible and the machine idle while recording.`);
  return { name, file, duration, size, cues: director.cues, chapter };
}

let server = null;

/**
 * Serves `root` (default: the workspace) over http on localhost, so motion pages can load ES
 * modules (three.js and friends refuse file:// URLs) and videos can seek (byte ranges).
 * Returns the base URL; one server per process.
 */
export async function serve(root = '.') {
  if (server) return server.url;
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { extname } = await import('node:path');
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.woff2': 'font/woff2'
  };
  const base = resolve(root);
  const srv = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(base, `.${path}`);
      if (!file.startsWith(base)) throw new Error('outside root');
      const body = await readFile(file);
      const type = types[extname(file)] || 'application/octet-stream';
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const from = range[1] ? Number(range[1]) : 0;
        const to = range[2] ? Number(range[2]) : body.length - 1;
        res.writeHead(206, {
          'content-type': type,
          'accept-ranges': 'bytes',
          'content-range': `bytes ${from}-${to}/${body.length}`
        });
        res.end(body.subarray(from, to + 1));
      } else {
        res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' });
        res.end(body);
      }
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((done) => srv.listen(0, '127.0.0.1', done));
  srv.unref();
  server = { url: `http://127.0.0.1:${srv.address().port}` };
  return server.url;
}

/**
 * Renders a motion page frame by frame: for every frame the page's
 * `window.seek(t)` sets the state at `t` seconds (it may return a promise),
 * then one screenshot is taken. No dropped frames and exact timing, however
 * expensive the page is to draw - 3D scenes, many layers, videos. `url` is a
 * full URL or a path in the workspace (served over http, see serve()). The
 * page may set `window.motionReady = false` until its assets are loaded.
 */
export async function captureFrames(director, name, url, { seconds, fps = 30, dir = 'out', chapter, before } = {}) {
  const { page, size } = director;
  const target = /^[a-z]+:/i.test(url) ? url : `${await serve()}/${url.replace(/^\.?\//, '')}`;
  await page.goto(target);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.seek === 'function' && window.motionReady !== false, null, {
    timeout: 60000
  });
  if (before) await before(director);
  const framesDir = resolve(dir, 'frames', name);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const n = Math.round(seconds * fps);
  for (let k = 0; k < n; k++) {
    await page.evaluate(async (t) => {
      await window.seek(t);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, k / fps);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
    writeFileSync(join(framesDir, `s${String(k).padStart(6, '0')}.jpg`), Buffer.from(data, 'base64'));
  }
  await cdp.detach().catch(() => {});
  const file = resolve(dir, `${name}.mp4`);
  await ffmpeg([
    '-framerate',
    String(fps),
    '-i',
    join(framesDir, 's%06d.jpg'),
    '-vf',
    `scale=${size.width}:${size.height}:flags=lanczos,format=yuv420p`,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '14',
    file
  ]);
  console.log(`${name}: ${seconds}s, ${n} frames rendered`);
  return { name, file, duration: n / fps, size, cues: [], chapter };
}

/**
 * Records a card from cards.html - intro, chapter or outro - filled with
 * `data`, holding it for `seconds`. Rendered frame by frame through the
 * card's seek(), so every animation lands exactly. Use a stage with cursor: false.
 */
export async function captureCard(
  director,
  name,
  { cards = 'cards.html', scene, data = {}, seconds = 3, dir, chapter }
) {
  return captureFrames(director, name, `${pathToFileURL(resolve(cards)).href}?scene=${scene}`, {
    seconds,
    dir,
    chapter,
    before: async (d) => {
      await d.page.evaluate((v) => window.fill(v), data);
      await d.page.evaluate(() => document.fonts.ready);
      await d.page.waitForLoadState('networkidle');
    }
  });
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

/**
 * Measures what eyes call flicker: single-frame blips (a frame that differs
 * from both neighbours) and single-frame stalls inside motion (a repeated
 * frame that makes movement judder). Frames are compared at a small grey
 * size. Returns their times in seconds - stills show neither.
 */
export async function smoothness(video, { width = 160, fps = 30 } = {}) {
  const height = Math.round((width * 9) / 16);
  const n = width * height;
  const r = spawnSync(
    await ffmpegBin(),
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      video,
      '-vf',
      `fps=${fps},scale=${width}:${height}:flags=area,format=gray`,
      '-f',
      'rawvideo',
      '-'
    ],
    { maxBuffer: 2 ** 31 }
  );
  const buf = r.stdout;
  const count = Math.floor(buf.length / n);
  const diff = (a, b) => {
    let s = 0;
    for (let k = 0; k < n; k++) s += Math.abs(buf[a * n + k] - buf[b * n + k]);
    return s / n;
  };
  const d1 = [];
  const d2 = [];
  for (let i = 0; i + 1 < count; i++) d1.push(diff(i, i + 1));
  for (let i = 0; i + 2 < count; i++) d2.push(diff(i, i + 2));
  const at = (i) => +(i / fps).toFixed(2);
  return { frames: count, blips: findBlips(d1, d2).map(at), stalls: findStalls(d1).map(at) };
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
