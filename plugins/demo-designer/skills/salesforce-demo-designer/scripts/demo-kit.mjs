// Demo Kit - turns a scripted browser session into a polished demo video:
// a visible cursor with click ripples, captions, focus frames, camera zooms,
// intro, chapter and outro cards, frame-exact motion graphics, cross-fades,
// subtitles and chapter marks.
//
// Copy this file and ../assets/cards.html into a demo workspace that has
// playwright-core and ffmpeg-static installed; a storyboard script imports it.
// Both packages are loaded on first use, so the pure helpers below work
// without them.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/* ---------- Edit: pure helpers ------------------------------------------- */

/**
 * Checks the parts of a take to keep - [[from, to], ...] in seconds, in order, not
 * overlapping, each longer than the cross-fade between them.
 */
export function checkKeep(keep, duration, fade) {
  if (!Array.isArray(keep) || !keep.length) throw new Error('cut(): keep at least one part, [[from, to], ...].');
  keep.forEach(([from, to], i) => {
    if (!(to > from)) throw new Error(`cut(): part ${i + 1} ends before it starts (${from}-${to}).`);
    if (from < 0 || to > duration + 0.05)
      throw new Error(`cut(): part ${i + 1} (${from}-${to}) lies outside the scene (0-${duration.toFixed(2)}).`);
    if (i && from < keep[i - 1][1]) throw new Error(`cut(): part ${i + 1} overlaps the part before it.`);
    if (keep.length > 1 && to - from <= fade)
      throw new Error(`cut(): part ${i + 1} is ${(to - from).toFixed(2)}s - shorter than the ${fade}s fade.`);
  });
}

/** Where each kept part starts in the cut scene, when neighbours overlap by `fade` seconds. */
export function cutOffsets(keep, fade) {
  return sceneOffsets(
    keep.map(([from, to]) => to - from),
    fade
  );
}

/** ffmpeg filter graph that trims the parts out of input 0 and cross-fades them into [v]. */
export function cutGraph(keep, fade) {
  const parts = keep.map(
    ([from, to], i) => `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,fps=30,format=yuv420p[p${i}]`
  );
  if (keep.length === 1) return `${parts[0].replace(/\[p0\]$/, '[v]')}`;
  const offsets = cutOffsets(keep, fade);
  const steps = [];
  let previous = '[p0]';
  for (let i = 1; i < keep.length; i++) {
    const out = i === keep.length - 1 ? '[v]' : `[x${i}]`;
    steps.push(`${previous}[p${i}]xfade=transition=fade:duration=${fade}:offset=${offsets[i].toFixed(3)}${out}`);
    previous = out;
  }
  return [...parts, ...steps].join(';');
}

/**
 * Scene cues moved onto the cut timeline. A cue keeps the parts of it that survive the cut;
 * a cue that lies entirely in a removed stretch is dropped.
 */
export function cutCues(cues, keep, fade, duration) {
  const offsets = cutOffsets(keep, fade);
  const at = (t) => {
    for (let i = keep.length - 1; i >= 0; i--)
      if (t >= keep[i][0]) return offsets[i] + Math.min(t, keep[i][1]) - keep[i][0];
    return 0;
  };
  return cues.flatMap((cue) => {
    const end = cue.end ?? duration;
    const first = keep.find(([from, to]) => cue.start < to && end > from);
    if (!first) return [];
    return [{ ...cue, start: at(Math.max(cue.start, first[0])), end: at(end) }];
  });
}

/** Length of the cut scene. */
export function cutDuration(keep, fade) {
  return totalDuration(
    keep.map(([from, to]) => to - from),
    fade
  );
}

/**
 * ffmpeg filter graph that holds the frame at each `at` for `seconds` - [{ at, seconds }],
 * sorted - and plays the rest unchanged, into [v].
 */
export function freezeGraph(holds) {
  const frame = (1 / 30).toFixed(6);
  const steps = [];
  const labels = [];
  let previous = 0;
  holds.forEach(({ at, seconds }, i) => {
    steps.push(`[0:v]trim=start=${previous}:end=${at},setpts=PTS-STARTPTS[s${i}]`);
    steps.push(
      `[0:v]trim=start=${at}:duration=${frame},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${seconds}[f${i}]`
    );
    labels.push(`[s${i}]`, `[f${i}]`);
    previous = +(at + 1 / 30).toFixed(6);
  });
  steps.push(`[0:v]trim=start=${previous},setpts=PTS-STARTPTS[s${holds.length}]`);
  labels.push(`[s${holds.length}]`);
  steps.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0,fps=30,format=yuv420p[v]`);
  return steps.join(';');
}

/** Scene cues moved by the holds before them; a cue that spans a hold grows by it. */
export function freezeCues(cues, holds) {
  const shift = (t) => t + holds.filter((h) => h.at < t).reduce((sum, h) => sum + h.seconds, 0);
  return cues.map((cue) => ({
    ...cue,
    start: shift(cue.start),
    end: cue.end === undefined ? undefined : shift(cue.end)
  }));
}

/**
 * Holds that keep every caption on screen for at least `min` seconds: the frame one second
 * into a short caption is held for what it lacks. `skip` lists cue indexes to leave alone -
 * a caption over a moving result reads better short than frozen.
 */
export function readableHolds(cues, { min = 4, skip = [] } = {}) {
  return cues
    .map((cue, i) => ({ cue, i }))
    .filter(({ cue, i }) => !skip.includes(i) && cue.end !== undefined && cue.end - cue.start < min - 0.2)
    .map(({ cue }) => ({
      at: +Math.min(cue.start + 1, cue.end - 0.1).toFixed(3),
      seconds: +(min - (cue.end - cue.start)).toFixed(2)
    }));
}

/* ---------- Retouch: pure helpers ---------------------------------------- */

// A frame is { data, width, height }: raw RGB, three bytes a pixel, rows top to bottom.

/**
 * Connected areas of pixels that match `match(r, g, b)` - a red error badge, a counter -
 * as boxes { x, y, width, height }. Searched on a grid of `step` pixels inside `region`.
 * `min` and `max` ([width, height]) drop what is too small or too large; `solid` keeps only
 * areas whose four inset corners match too, so a filled badge counts and a ring does not.
 */
export function findAreas(
  frame,
  match,
  { region, step = 2, min = [0, 0], max = [Infinity, Infinity], solid = false } = {}
) {
  const { data, width, height } = frame;
  const r = region ?? { x: 0, y: 0, width, height };
  const px = (x, y) => {
    const i = (y * width + x) * 3;
    return match(data[i], data[i + 1], data[i + 2]);
  };
  const gw = Math.floor(r.width / step);
  const gh = Math.floor(r.height / step);
  const seen = new Uint8Array(gw * gh);
  const at = (gx, gy) => px(r.x + gx * step, r.y + gy * step);
  const areas = [];
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const start = gy * gw + gx;
      if (seen[start] || !at(gx, gy)) continue;
      seen[start] = 1;
      let [x0, x1, y0, y1] = [gx, gx, gy, gy];
      const stack = [start];
      while (stack.length) {
        const c = stack.pop();
        const cx = c % gw;
        const cy = (c - cx) / gw;
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ]) {
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const n = ny * gw + nx;
          if (seen[n] || !at(nx, ny)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      const box = {
        x: r.x + x0 * step,
        y: r.y + y0 * step,
        width: (x1 - x0 + 1) * step,
        height: (y1 - y0 + 1) * step
      };
      if (box.width < min[0] || box.height < min[1] || box.width > max[0] || box.height > max[1]) continue;
      if (solid) {
        const inset = Math.max(step, Math.round(Math.min(box.width, box.height) / 5));
        const xs = [box.x + inset, box.x + box.width - 1 - inset];
        const ys = [box.y + inset, box.y + box.height - 1 - inset];
        if (!xs.every((x) => ys.every((y) => px(x, y)))) continue;
      }
      areas.push(box);
    }
  }
  return areas;
}

const clampBox = (frame, { x, y, width, height }) => {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  return {
    x0,
    y0,
    x1: Math.min(frame.width, Math.ceil(x + width)),
    y1: Math.min(frame.height, Math.ceil(y + height))
  };
};

/** Copies `box` from one frame into another of the same size - a clean toolbar over a noisy one. */
export function copyRegion(from, to, box) {
  const { x0, y0, x1, y1 } = clampBox(to, box);
  for (let y = y0; y < y1; y++)
    from.data.copy(to.data, (y * to.width + x0) * 3, (y * from.width + x0) * 3, (y * from.width + x1) * 3);
}

/**
 * Paints `box` out with the background beside it: each row takes the colour of the pixel
 * `gap` pixels to its left, so a badge on a plain or striped surface disappears without a patch.
 */
export function fillFromLeft(frame, box, { gap = 8 } = {}) {
  const { data, width } = frame;
  const { x0, y0, x1, y1 } = clampBox(frame, box);
  const sx = Math.max(0, x0 - gap);
  for (let y = y0; y < y1; y++) {
    const s = (y * width + sx) * 3;
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 3;
      data[i] = data[s];
      data[i + 1] = data[s + 1];
      data[i + 2] = data[s + 2];
    }
  }
}

/**
 * Replaces a text in `box` with the glyphs of `mask` (one coverage value 0-1 a pixel, the
 * box's size - from textMask()), in the ink colour found in this frame, over each row's own
 * background. Matching every frame keeps the label right under hover states, fades and the
 * dimmed backdrop of a dialog; pixels brighter than the row's background by more than
 * `brighter` belong to something on top - a dialog - and stay. The ink is the most saturated
 * pixel that `isInk` accepts (a link's blue); pass `ink: [r, g, b]` for grey or black text.
 * Returns false, leaving the frame alone, when fewer than `minInk` pixels look like ink: the
 * label is not there. `box` is in whole pixels.
 */
export function replaceText(
  frame,
  box,
  mask,
  { isInk = (r, g, b) => b - r > 50, ink: fixed = null, minInk = 40, brighter = 25 } = {}
) {
  const { data, width } = frame;
  const { x0, y0, x1, y1 } = clampBox(frame, box);
  let ink = null;
  let best = -Infinity;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 3;
      if (!isInk(data[i], data[i + 1], data[i + 2])) continue;
      count++;
      const strength = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      if (strength > best) {
        best = strength;
        ink = [data[i], data[i + 1], data[i + 2]];
      }
    }
  }
  if (count < minInk || !ink) return false;
  if (fixed) ink = fixed;
  for (let y = y0; y < y1; y++) {
    const counts = new Map();
    let bg = null;
    let most = 0;
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 3;
      if (isInk(data[i], data[i + 1], data[i + 2])) continue;
      const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      if (n > most) {
        most = n;
        bg = [data[i], data[i + 1], data[i + 2]];
      }
    }
    if (!bg) continue;
    const lum = (bg[0] + bg[1] + bg[2]) / 3;
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 3;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 > lum + brighter) continue;
      const a = mask[(y - box.y) * box.width + (x - box.x)] ?? 0;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(bg[c] * (1 - a) + ink[c] * a);
    }
  }
  return true;
}

/** The part of `rect` ({ x, y, width, height }) that lies inside every one of `clips`, or null. */
export function clipRect(rect, clips) {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  for (const c of clips) {
    left = Math.max(left, c.x);
    top = Math.max(top, c.y);
    right = Math.min(right, c.x + c.width);
    bottom = Math.min(bottom, c.y + c.height);
  }
  return right - left < 2 || bottom - top < 2 ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

/** A pattern from words and regular expressions, as source and flags that survive JSON. */
export function denyPattern(words) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = [words]
    .flat()
    .filter(Boolean)
    .map((w) => (w instanceof RegExp ? w.source : escape(String(w))));
  return parts.length ? { source: parts.join('|'), flags: 'i' } : null;
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

/* ---------- Typing: pure helpers ----------------------------------------- */

const NOT_TYPED_INTO = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
]);

/**
 * Whether keys typed now reach a field: a text input, a textarea or a contenteditable element,
 * not read-only or disabled. A focused iframe counts - its inside is out of reach.
 */
export function isEditable({ tag, type = null, readOnly = false, disabled = false, editable = false }) {
  if (disabled || readOnly) return false;
  if (editable) return true;
  const name = String(tag).toUpperCase();
  if (name === 'TEXTAREA' || name === 'IFRAME') return true;
  return name === 'INPUT' && !NOT_TYPED_INTO.has(String(type ?? 'text').toLowerCase());
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

/** Width and height of a video, read from ffmpeg's stream info (ffmpeg-static has no ffprobe). */
async function videoSize(video) {
  const r = spawnSync(await ffmpegBin(), ['-hide_banner', '-i', video], { encoding: 'utf8' });
  const m = /Video:.*?, (\d{2,5})x(\d{2,5})[\s,[]/.exec(r.stderr ?? '');
  if (!m) throw new Error(`Cannot read the size of ${video}.`);
  return { width: Number(m[1]), height: Number(m[2]) };
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
export async function launch({ args = [] } = {}) {
  const { chromium } = await import('playwright-core');
  return chromium.launch({ channel: 'chrome', headless: false, args });
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
function overlay({ theme, hide, blur, cursor, css: extra, conceal }) {
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
    ${extra || ''}
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
        let r;
        if (el && 'box' in el) {
          // an element inside a frame, measured and clipped by the director
          if (!el.box) continue;
          r = { left: el.box.x, top: el.box.y, right: el.box.x + el.box.width, bottom: el.box.y + el.box.height };
        } else {
          if (!el?.isConnected) continue;
          const b = el.getBoundingClientRect();
          const c = clipOf(el);
          r = {
            left: Math.max(b.left, c.left),
            top: Math.max(b.top, c.top),
            right: Math.min(b.right, c.right),
            bottom: Math.min(b.bottom, c.bottom)
          };
        }
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

  // Rows and options that name what must not appear - another client's records in a shared
  // org - are hidden as they render, in every frame and through shadow roots.
  if (conceal) {
    const deny = new RegExp(conceal.source, conceal.flags);
    const rows = '[role=option], [role=menuitem], [role=row], tr, lightning-base-combobox-item';
    const sweep = (root) => {
      root.querySelectorAll(rows).forEach((el) => {
        if (el.style.display !== 'none' && deny.test(el.innerText || el.textContent || ''))
          el.style.setProperty('display', 'none', 'important');
      });
      root.querySelectorAll('*').forEach((el) => el.shadowRoot && sweep(el.shadowRoot));
    };
    setInterval(() => {
      try {
        sweep(document);
      } catch {
        /* a document in the middle of unloading */
      }
    }, 300);
  }
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
    css = '',
    conceal = [],
    cursor = true
  } = {}
) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme });
  await context.addInitScript(overlay, {
    theme: { ...DEFAULT_THEME, ...theme },
    hide,
    blur,
    css,
    conceal: denyPattern(conceal),
    cursor
  });
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
    this.focusing = null;
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

  /** The deepest focused element, through shadow roots, as `isEditable` reads it. */
  async focused() {
    return this.page.evaluate(() => {
      let element = document.activeElement;
      while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
      return {
        tag: element?.tagName ?? 'BODY',
        type: element?.getAttribute?.('type') ?? null,
        readOnly: Boolean(element?.readOnly),
        disabled: Boolean(element?.disabled),
        editable: Boolean(element?.isContentEditable)
      };
    });
  }

  /**
   * Types like a person - into the focused element, or into `target` after clicking it.
   * Without a target it refuses when nothing editable has focus: the keys would go to the
   * page, where End, Space and PageDown scroll it and the text lands nowhere.
   */
  async type(text, { target, delay = 70, clear = false } = {}) {
    if (target) await this.click(target);
    else {
      const focus = await this.focused();
      if (!isEditable(focus)) {
        throw new Error(
          `type() without a target, but the focus is on <${focus.tag.toLowerCase()}>, not on an editable field - the keys would go to the page. Pass { target }, or check that the click before it left the focus in the field.`
        );
      }
    }
    if (clear) await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.type(text, { delay });
  }

  /**
   * One key, such as `Enter` or `Escape`. `End` and `Home` in a single-line text field move the
   * caret directly: as a key press, Chrome scrolls the whole page when the caret already sits at
   * that end, and the typing that follows happens out of frame.
   */
  async press(key) {
    if (key === 'End' || key === 'Home') {
      const moved = await this.page.evaluate((k) => {
        let element = document.activeElement;
        while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
        if (element?.tagName !== 'INPUT' || typeof element.value !== 'string') return false;
        try {
          const at = k === 'End' ? element.value.length : 0;
          element.setSelectionRange(at, at); // throws for types without a caret (email, number)
          return true;
        } catch {
          return false;
        }
      }, key);
      if (moved) return;
    }
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
   * so it never frames something the viewer cannot see. Elements inside frames - dashboards,
   * editors - are measured from here ten times a second and clipped by their frames and the
   * window. Throws if a target matches nothing within `timeout` - a scene keeps recording while
   * a locator waits - or if nothing of them is visible.
   */
  async focus(target, { pad = 6, timeout = 3000 } = {}) {
    const main = this.page.mainFrame();
    const items = await Promise.all(
      [target].flat().map(async (t) => {
        const locator = this.locate(t);
        const handle = await locator.elementHandle({ timeout }).catch(() => null);
        if (!handle) throw new Error(`focus(): nothing matches ${locator} within ${timeout} ms - check it in a probe.`);
        const frame = await handle.ownerFrame();
        return frame === main ? { handle } : { locator, frame };
      })
    );
    const token = {};
    this.focusing = token;
    const send = async () => {
      const payload = await Promise.all(items.map(async (it) => it.handle ?? { box: await this.frameBox(it) }));
      if (this.focusing !== token) return;
      await this.page.evaluate(([els, p]) => window.__demo?.focus(els, p), [payload, pad]);
    };
    await send();
    if (items.some((it) => !it.handle)) {
      (async () => {
        while (this.focusing === token) {
          await sleep(100);
          await send().catch(() => {});
        }
      })();
    }
    await sleep(60);
    if (!(await this.page.evaluate(() => window.__demo?.visible()))) {
      await this.unfocus();
      throw new Error('focus(): the target is not visible - scroll it into view (scrollToElement) first.');
    }
  }

  /** Where an element inside a frame is on screen, clipped by its frames and the window - or null. */
  async frameBox({ locator, frame }) {
    const box = await locator.boundingBox({ timeout: 500 }).catch(() => null);
    if (!box) return null;
    const clips = [{ x: 0, y: 0, width: this.viewport.width, height: this.viewport.height }];
    for (let f = frame; f?.parentFrame(); f = f.parentFrame()) {
      const element = await f.frameElement().catch(() => null);
      const b = element && (await element.boundingBox().catch(() => null));
      if (b) clips.push(b);
    }
    return clipRect(box, clips);
  }

  async unfocus() {
    this.focusing = null;
    await this.page.evaluate(() => window.__demo?.focus(null));
  }

  /**
   * Zooms the camera onto one or more elements, applied when the scene is encoded. The factor
   * is capped so the whole target stays in frame. Captions belong to the page and zoom with
   * it: zoom in caption-free beats or caption after zoomOut(). Throws when the target matches
   * nothing within `timeout`, instead of filling the take with a wait.
   */
  async zoom(target, { scale = 1.6, ms = 900, margin = 0.86, timeout = 3000 } = {}) {
    if (this.sceneStart === null) throw new Error('zoom() works inside captureScene only.');
    const boxes = await Promise.all(
      [target].flat().map((t) =>
        this.locate(t)
          .boundingBox({ timeout })
          .catch(() => null)
      )
    );
    if (!boxes.some(Boolean))
      throw new Error(`zoom(): nothing of the target is on the page within ${timeout} ms - check it in a probe.`);
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
  // Not until the load event: a Lightning page with many components can miss it, and ready() is what counts.
  await director.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
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
    director.focusing = null;
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

/* ---------- Edit --------------------------------------------------------- */

const encode = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '30'];

/**
 * Keeps only the parts `keep` ([[from, to], ...] in seconds) of a recorded scene, joined by
 * short cross-fades, and moves its captions with them. For waits that belong off camera -
 * a generation, a notice to dismiss, a page that loads. Returns a scene for render().
 */
export async function cut(scene, keep, { fade = 0.3, name = `${scene.name}-cut`, dir = 'out' } = {}) {
  checkKeep(keep, scene.duration, fade);
  mkdirSync(resolve(dir), { recursive: true });
  const file = resolve(dir, `${name}.mp4`);
  await ffmpeg(['-i', scene.file, '-filter_complex', cutGraph(keep, fade), '-map', '[v]', ...encode, file]);
  return {
    ...scene,
    name,
    file,
    duration: cutDuration(keep, fade),
    cues: cutCues(scene.cues ?? [], keep, fade, scene.duration)
  };
}

/**
 * Holds single frames of a scene - [{ at, seconds }] - so a caption or a result stays on
 * screen longer without slowing the motion around it. Returns a scene for render().
 */
export async function freeze(scene, holds, { name = `${scene.name}-hold`, dir = 'out' } = {}) {
  if (!holds.length) return scene;
  const sorted = [...holds].sort((a, b) => a.at - b.at);
  mkdirSync(resolve(dir), { recursive: true });
  const file = resolve(dir, `${name}.mp4`);
  await ffmpeg(['-i', scene.file, '-filter_complex', freezeGraph(sorted), '-map', '[v]', ...encode, file]);
  return {
    ...scene,
    name,
    file,
    duration: scene.duration + sorted.reduce((sum, h) => sum + h.seconds, 0),
    cues: freezeCues(scene.cues ?? [], sorted)
  };
}

/** Holds frames so every caption of the scene stays on screen for at least `min` seconds. */
export async function readable(scene, { min = 4, skip = [], name = `${scene.name}-readable`, dir = 'out' } = {}) {
  const holds = readableHolds(scene.cues ?? [], { min, skip });
  return holds.length ? freeze(scene, holds, { name, dir }) : scene;
}

/* ---------- Retouch ------------------------------------------------------ */

/**
 * Runs `edit(frame, index, t)` on every frame of a video and encodes the result to `out` -
 * for UI noise that cannot be fixed before the take: an error badge, a counter, a label.
 * `frame` is { data, width, height } with raw RGB that `edit` changes in place, synchronously;
 * it returns true when it changed something. `report: true` only counts, without encoding.
 * Returns { frames, changed }.
 */
export async function retouch(video, out, edit, { report = false } = {}) {
  const bin = await ffmpegBin();
  const { width, height } = await videoSize(video);
  const size = width * height * 3;
  const quiet = ['-hide_banner', '-loglevel', 'error'];
  if (!report) mkdirSync(dirname(resolve(out)), { recursive: true });
  const dec = spawn(bin, [...quiet, '-i', video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const enc = report
    ? null
    : spawn(bin, [
        '-y',
        ...quiet,
        ...['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-r', '30', '-i', '-'],
        ...encode,
        resolve(out)
      ]);
  const exit = (p) =>
    new Promise((done, fail) =>
      p.on('close', (code) => (code ? fail(new Error(`ffmpeg exited with ${code}`)) : done()))
    );
  const finished = Promise.all([exit(dec), enc ? exit(enc) : null]);
  let frame = Buffer.alloc(size);
  let filled = 0;
  let index = 0;
  let changed = 0;
  dec.stdout.on('data', (chunk) => {
    for (let offset = 0; offset < chunk.length;) {
      const n = Math.min(size - filled, chunk.length - offset);
      chunk.copy(frame, filled, offset, offset + n);
      filled += n;
      offset += n;
      if (filled < size) continue;
      if (edit({ data: frame, width, height }, index, index / 30)) changed++;
      index++;
      if (enc && !enc.stdin.write(frame)) {
        dec.stdout.pause();
        enc.stdin.once('drain', () => dec.stdout.resume());
      }
      frame = Buffer.alloc(size);
      filled = 0;
    }
  });
  dec.stdout.on('end', () => enc?.stdin.end());
  await finished;
  console.log(`${report ? video : out}: ${changed} of ${index} frames ${report ? 'to retouch' : 'retouched'}`);
  return { frames: index, changed };
}

/** One frame of a video as { data, width, height } - a clean reference to patch others from. */
export async function frameAt(video, at) {
  const { width, height } = await videoSize(video);
  const r = spawnSync(
    await ffmpegBin(),
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(at),
      '-i',
      video,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-'
    ],
    { maxBuffer: width * height * 4 }
  );
  if (r.stdout.length < width * height * 3) throw new Error(`No frame at ${at}s in ${video}.`);
  return { data: r.stdout.subarray(0, width * height * 3), width, height };
}

/**
 * The glyphs of `text` as coverage values (0-1 a pixel) in a box of `width` x `height`, for
 * replaceText(). `x` and `y` place the text inside the box; pick a `fontfile` and `size` that
 * match the interface (Salesforce Sans is close to Helvetica Neue).
 */
export async function textMask(
  text,
  { width, height, x = 0, y = 0, size = 20, fontfile = '/System/Library/Fonts/HelveticaNeue.ttc' }
) {
  // The text goes through a file: quotes, colons and percent signs in a filter argument need
  // escaping that differs between ffmpeg versions.
  const dir = mkdtempSync(join(tmpdir(), 'demo-kit-'));
  const textfile = join(dir, 'text.txt');
  writeFileSync(textfile, String(text));
  const draw = `drawtext=fontfile='${fontfile}':textfile='${textfile}':expansion=none:fontsize=${size}:fontcolor=black:x=${x}:y=${y}`;
  const r = spawnSync(
    await ffmpegBin(),
    [
      ...['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=white:s=${width}x${height}`],
      ...['-vf', draw, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
    ],
    { maxBuffer: width * height * 2 }
  );
  rmSync(dir, { recursive: true, force: true });
  if (r.stdout.length < width * height) throw new Error(`textMask(): ffmpeg could not draw the text - ${r.stderr}`);
  return Float32Array.from(r.stdout.subarray(0, width * height), (v) => 1 - v / 255);
}

/* ---------- Review and delivery ------------------------------------------ */

/**
 * The words of `words` (strings or regular expressions) that are visible on the stage's page
 * right now - in every frame, through shadow roots and in input values. Run it before and
 * after every take in a shared org; text drawn on canvas is not covered, look at the stills.
 */
export async function leaks(director, words) {
  const deny = denyPattern(words);
  if (!deny) return [];
  const pattern = new RegExp(deny.source, 'gi');
  const found = new Set();
  for (const frame of director.page.frames()) {
    const text = await frame
      .evaluate(() => {
        const out = [document.body?.innerText ?? ''];
        const walk = (root) =>
          root.querySelectorAll('*').forEach((el) => {
            if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'hidden') out.push(el.value);
            if (el.shadowRoot) {
              for (const child of el.shadowRoot.children) out.push(child.innerText ?? '');
              walk(el.shadowRoot);
            }
          });
        walk(document);
        return out.join('\n');
      })
      .catch(() => '');
    for (const m of text.matchAll(pattern)) found.add(m[0].toLowerCase());
  }
  return [...found];
}

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
