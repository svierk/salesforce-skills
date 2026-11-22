// Tests the Demo Designer's recorder library without a browser or ffmpeg: the
// timing of frames, the camera, the smoothness checks, the cross-fade graph,
// subtitles and chapter marks. The import itself proves the library loads
// without playwright-core and ffmpeg-static, which it only needs once it records.

import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraAt,
  cameraFilter,
  chapters,
  checkKeep,
  clipRect,
  copyRegion,
  cropOf,
  crossfadeGraph,
  cutCues,
  cutDuration,
  cutGraph,
  denyPattern,
  fillFromLeft,
  findAreas,
  findBlips,
  findStalls,
  fitZoom,
  frameSequence,
  freezeCues,
  freezeGraph,
  isEditable,
  joinCues,
  outputSize,
  plain,
  readableHolds,
  replaceText,
  sceneOffsets,
  srt,
  totalDuration,
  unionRect
} from '../../plugins/demo-designer/skills/salesforce-demo-designer/scripts/demo-kit.mjs';

const skill = new URL('../../plugins/demo-designer/skills/salesforce-demo-designer/', import.meta.url).pathname;

describe('outputSize', () => {
  test('multiplies the viewport by the scale', () => {
    assert.deepEqual(outputSize({ width: 1280, height: 720, scale: 1.5 }), { width: 1920, height: 1080 });
    assert.deepEqual(outputSize({ width: 1600, height: 900, scale: 1.2 }), { width: 1920, height: 1080 });
  });

  test('rounds to even numbers, as H.264 needs', () => {
    assert.deepEqual(outputSize({ width: 901, height: 901, scale: 1 }), { width: 902, height: 902 });
  });
});

describe('frameSequence', () => {
  const frames = [
    { file: 'a.jpg', t: 9.5 },
    { file: 'b.jpg', t: 10.2 },
    { file: 'c.jpg', t: 11 },
    { file: 'd.jpg', t: 13.5 }
  ];

  test('shows every frame until the next one arrives, at a constant rate', () => {
    assert.deepEqual(frameSequence(frames, 10, 12, 5), [
      'a.jpg',
      'b.jpg',
      'b.jpg',
      'b.jpg',
      'b.jpg',
      'c.jpg',
      'c.jpg',
      'c.jpg',
      'c.jpg',
      'c.jpg'
    ]);
  });

  test('has one entry per frame of the scene', () => {
    assert.equal(frameSequence(frames, 10, 12, 30).length, 60);
  });

  test('keeps the last frame before the start when the page did not change', () => {
    assert.deepEqual(frameSequence([{ file: 'still.jpg', t: 3 }], 5, 6, 3), ['still.jpg', 'still.jpg', 'still.jpg']);
  });

  test('drops frames that arrive after the end', () => {
    assert.ok(!frameSequence(frames, 10, 12, 30).includes('d.jpg'));
  });

  test('does not merge or skip frames that arrive every tick', () => {
    const steady = Array.from({ length: 40 }, (_, i) => ({ file: `f${i}`, t: i / 30 }));
    assert.deepEqual(
      frameSequence(steady, 0, 1, 30),
      steady.slice(0, 30).map((f) => f.file)
    );
  });

  test('refuses a scene without frames', () => {
    assert.throws(() => frameSequence([], 0, 1), /No frames/);
  });
});

describe('camera', () => {
  const viewport = { width: 1600, height: 900 };

  test('caps the zoom so the whole target stays in frame', () => {
    const wide = fitZoom({ x: 100, y: 100, width: 1200, height: 100 }, viewport, { scale: 2 });
    assert.ok(Math.abs(wide.scale - (0.86 * 1600) / 1200) < 1e-9);
    assert.equal(fitZoom({ x: 700, y: 400, width: 100, height: 50 }, viewport, { scale: 1.6 }).scale, 1.6);
  });

  test('never zooms out below the full frame', () => {
    assert.equal(fitZoom({ x: 0, y: 0, width: 1600, height: 900 }, viewport).scale, 1);
  });

  test('keeps the crop inside the page near an edge', () => {
    const cam = fitZoom({ x: 0, y: 0, width: 100, height: 60 }, viewport, { scale: 2 });
    const crop = cropOf(cam, viewport);
    assert.deepEqual([crop.x, crop.y, crop.width, crop.height], [0, 0, 800, 450]);
  });

  test('frames several elements together', () => {
    assert.deepEqual(
      unionRect([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 100, y: 5, width: 10, height: 10 }
      ]),
      { x: 10, y: 5, width: 100, height: 55 }
    );
  });

  test('eases between moves and holds after them', () => {
    const keys = [{ t: 1, ms: 1000, scale: 2, x: 400, y: 225 }];
    assert.deepEqual(cameraAt(keys, 0.5, viewport), { scale: 1, x: 800, y: 450 });
    const mid = cameraAt(keys, 1.5, viewport);
    assert.ok(Math.abs(mid.scale - 1.5) < 1e-9 && Math.abs(mid.x - 600) < 1e-9);
    assert.deepEqual(cameraAt(keys, 5, viewport), { scale: 2, x: 400, y: 225 });
  });

  test('builds a per-frame perspective filter, or nothing without moves', () => {
    assert.equal(cameraFilter([], viewport), '');
    const f = cameraFilter([{ t: 1, ms: 800, scale: 1.5, x: 600, y: 300 }], viewport, 30);
    assert.match(f, /^perspective=x0='/);
    assert.match(f, /interpolation=cubic:sense=source:eval=frame$/);
    assert.match(f, /\(in\/30\)/);
  });
});

describe('smoothness', () => {
  test('finds a single frame that differs from both neighbours', () => {
    // frames: A A B A A - frame 2 is the blip
    const d1 = [0, 3, 3, 0];
    const d2 = [3, 0, 3];
    assert.deepEqual(findBlips(d1, d2), [2]);
  });

  test('ignores steady motion', () => {
    assert.deepEqual(findBlips([2, 2, 2, 2], [4, 4, 4]), []);
  });

  test('finds a repeated frame inside motion', () => {
    assert.deepEqual(findStalls([2, 2, 0, 2, 2]), [3]);
    assert.deepEqual(findStalls([0, 0, 0, 0]), []);
  });
});

describe('cross-fades', () => {
  test('a scene starts one fade before the previous one ends', () => {
    assert.deepEqual(sceneOffsets([3, 10, 4], 0.5), [0, 2.5, 12]);
    assert.equal(totalDuration([3, 10, 4], 0.5), 16);
  });

  test('chains xfade filters at those offsets into [v]', () => {
    assert.equal(
      crossfadeGraph([3, 10, 4], 0.5),
      '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=2.500[x1];' +
        '[x1][2:v]xfade=transition=fade:duration=0.5:offset=12.000,format=yuv420p[v]'
    );
  });

  test('passes a single scene through', () => {
    assert.equal(crossfadeGraph([5], 0.5), '[0:v]format=yuv420p[v]');
  });

  test('refuses a scene shorter than the fade', () => {
    assert.throws(() => crossfadeGraph([3, 0.4, 4], 0.5), /Scene 2/);
  });
});

describe('subtitles and chapters', () => {
  const scenes = [
    { duration: 3, cues: [], chapter: 'Intro' },
    {
      duration: 10,
      cues: [
        { start: 0.2, end: 4, text: 'Paste any URL' },
        { start: 4, end: 9.5, text: 'One click - a QR code' }
      ],
      chapter: 'Generate'
    },
    { duration: 4, cues: [] }
  ];

  test('moves scene cues onto the joined timeline', () => {
    assert.deepEqual(
      joinCues(scenes, 0.5).map(({ start, end }) => [start, end]),
      [
        [2.7, 6.5],
        [6.5, 12]
      ]
    );
  });

  test('writes SubRip', () => {
    assert.equal(
      srt(joinCues(scenes, 0.5)),
      '1\n00:00:02,700 --> 00:00:06,500\nPaste any URL\n\n2\n00:00:06,500 --> 00:00:12,000\nOne click - a QR code\n'
    );
  });

  test('formats hours, minutes and milliseconds', () => {
    assert.match(srt([{ start: 3725.0405, end: 3726, text: 'x' }]), /^1\n01:02:05,041 --> 01:02:06,000\n/);
  });

  test('lists chapter marks for scenes that have a chapter', () => {
    assert.deepEqual(chapters(scenes, 0.5), ['0:00 Intro', '0:02 Generate']);
  });

  test('turns caption markup into subtitle text', () => {
    assert.equal(plain('Refreshed artwork &amp; palette'), 'Refreshed artwork & palette');
    assert.equal(plain('QR codes,<br><em>right in Salesforce</em>'), 'QR codes, right in Salesforce');
  });
});

describe('typing', () => {
  test('accepts text fields, textareas, contenteditable and frames', () => {
    assert.ok(isEditable({ tag: 'INPUT' }));
    assert.ok(isEditable({ tag: 'input', type: 'tel' }));
    assert.ok(isEditable({ tag: 'TEXTAREA' }));
    assert.ok(isEditable({ tag: 'DIV', editable: true }));
    assert.ok(isEditable({ tag: 'IFRAME' }));
  });

  test('refuses the page, buttons and controls without text', () => {
    for (const focus of [
      { tag: 'BODY' },
      { tag: 'BUTTON' },
      { tag: 'INPUT', type: 'checkbox' },
      { tag: 'INPUT', type: 'submit' },
      { tag: 'A' }
    ]) {
      assert.equal(isEditable(focus), false, JSON.stringify(focus));
    }
  });

  test('refuses read-only and disabled fields', () => {
    assert.equal(isEditable({ tag: 'INPUT', readOnly: true }), false);
    assert.equal(isEditable({ tag: 'TEXTAREA', disabled: true }), false);
  });
});

describe('cuts and holds', () => {
  const cues = [
    { start: 1, end: 4, text: 'Describe the audience' },
    { start: 12, end: 14, text: 'Waiting' },
    { start: 22, end: 26, text: 'The result' }
  ];
  const keep = [
    [0, 10],
    [20, 30]
  ];

  test('refuses parts out of order, outside the scene or shorter than the fade', () => {
    assert.throws(() => checkKeep([], 30, 0.3), /at least one/);
    assert.throws(() => checkKeep([[5, 2]], 30, 0.3), /ends before/);
    assert.throws(() => checkKeep([[0, 40]], 30, 0.3), /outside/);
    assert.throws(
      () =>
        checkKeep(
          [
            [0, 10],
            [8, 20]
          ],
          30,
          0.3
        ),
      /overlaps/
    );
    assert.throws(
      () =>
        checkKeep(
          [
            [0, 10],
            [20, 20.2]
          ],
          30,
          0.3
        ),
      /shorter than/
    );
    assert.doesNotThrow(() => checkKeep(keep, 30, 0.3));
  });

  test('a cut is the kept parts minus one fade per join', () => {
    assert.equal(cutDuration(keep, 0.3), 19.7);
    assert.equal(cutDuration([[2, 7]], 0.3), 5);
  });

  test('moves captions with their parts and drops those that were cut out', () => {
    const moved = cutCues(cues, keep, 0.3, 30);
    assert.equal(moved.length, 2);
    assert.deepEqual(moved[0], cues[0]);
    assert.equal(moved[1].text, 'The result');
    assert.ok(Math.abs(moved[1].start - 11.7) < 1e-9);
    assert.ok(Math.abs(moved[1].end - 15.7) < 1e-9);
  });

  test('a caption that starts in a removed stretch starts with the next kept part', () => {
    const [cue] = cutCues([{ start: 8, end: 23, text: 'Across the cut' }], keep, 0.3, 30);
    assert.ok(Math.abs(cue.start - 8) < 1e-9);
    assert.ok(Math.abs(cue.end - 12.7) < 1e-9);
  });

  test('trims every part and cross-fades them in order', () => {
    const graph = cutGraph(keep, 0.3);
    assert.match(graph, /\[0:v\]trim=start=0:end=10,.*\[p0\]/);
    assert.match(graph, /\[0:v\]trim=start=20:end=30,.*\[p1\]/);
    assert.match(graph, /\[p0\]\[p1\]xfade=transition=fade:duration=0.3:offset=9.700\[v\]/);
    assert.match(cutGraph([[2, 7]], 0.3), /^\[0:v\]trim=start=2:end=7,.*\[v\]$/);
  });

  test('a hold repeats one frame and shifts what comes after it', () => {
    const holds = [{ at: 13, seconds: 2 }];
    assert.match(freezeGraph(holds), /trim=start=0:end=13,/);
    assert.match(freezeGraph(holds), /trim=start=13:duration=0.033333,.*tpad=stop_mode=clone:stop_duration=2\[f0\]/);
    assert.match(freezeGraph(holds), /trim=start=13.033333,/);
    assert.deepEqual(
      freezeCues(cues, holds).map((c) => [c.start, c.end]),
      [
        [1, 4],
        [12, 16],
        [24, 28]
      ]
    );
  });

  test('holds short captions until they are readable, except the skipped ones', () => {
    assert.deepEqual(readableHolds(cues, { min: 4 }), [
      { at: 2, seconds: 1 },
      { at: 13, seconds: 2 }
    ]);
    assert.deepEqual(readableHolds(cues, { min: 4, skip: [0, 1] }), []);
    assert.deepEqual(readableHolds([{ start: 5, end: 5.5, text: 'Short' }], { min: 4 }), [{ at: 5.4, seconds: 3.5 }]);
  });
});

describe('retouch', () => {
  const frameOf = (width, height, rgb) => {
    const data = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
    return { data, width, height };
  };
  const paint = (frame, { x, y, width, height }, rgb) => {
    for (let yy = y; yy < y + height; yy++)
      for (let xx = x; xx < x + width; xx++) frame.data.set(rgb, (yy * frame.width + xx) * 3);
  };
  const pixel = (frame, x, y) => [...frame.data.subarray((y * frame.width + x) * 3, (y * frame.width + x) * 3 + 3)];
  const red = (r, g, b) => r > 125 && g < 75 && b < 80;

  test('finds filled areas and leaves rings out when they must be solid', () => {
    const frame = frameOf(200, 100, [255, 255, 255]);
    paint(frame, { x: 20, y: 20, width: 30, height: 24 }, [220, 30, 30]);
    paint(frame, { x: 120, y: 20, width: 40, height: 40 }, [220, 30, 30]);
    paint(frame, { x: 126, y: 26, width: 28, height: 28 }, [255, 255, 255]);
    assert.equal(findAreas(frame, red).length, 2);
    const solid = findAreas(frame, red, { solid: true });
    assert.equal(solid.length, 1);
    assert.deepEqual(solid[0], { x: 20, y: 20, width: 30, height: 24 });
    assert.equal(findAreas(frame, red, { max: [35, 35] }).length, 1);
    assert.equal(findAreas(frame, red, { region: { x: 100, y: 0, width: 100, height: 100 } }).length, 1);
  });

  test('paints an area out with the background to its left', () => {
    const frame = frameOf(100, 40, [240, 240, 240]);
    paint(frame, { x: 40, y: 10, width: 20, height: 20 }, [220, 30, 30]);
    fillFromLeft(frame, { x: 38, y: 8, width: 24, height: 24 });
    assert.equal(findAreas(frame, red).length, 0);
    assert.deepEqual(pixel(frame, 50, 20), [240, 240, 240]);
  });

  test('copies a region from a clean frame', () => {
    const clean = frameOf(50, 50, [10, 20, 30]);
    const noisy = frameOf(50, 50, [200, 0, 0]);
    copyRegion(clean, noisy, { x: 10, y: 10, width: 5, height: 5 });
    assert.deepEqual(pixel(noisy, 12, 12), [10, 20, 30]);
    assert.deepEqual(pixel(noisy, 20, 20), [200, 0, 0]);
  });

  test('replaces a label in its own ink over the row background, and leaves a dialog on top alone', () => {
    const frame = frameOf(60, 10, [120, 120, 125]); // the page, dimmed behind a dialog
    paint(frame, { x: 2, y: 2, width: 30, height: 6 }, [10, 60, 120]); // the old label, dimmed too
    paint(frame, { x: 50, y: 0, width: 10, height: 10 }, [255, 255, 255]); // a dialog edge
    const box = { x: 0, y: 0, width: 60, height: 10 };
    const mask = new Float32Array(60 * 10);
    for (let x = 0; x < 60; x++) mask[5 * 60 + x] = 1; // one row of new "glyphs"
    assert.equal(replaceText(frame, box, mask, { minInk: 10 }), true);
    assert.deepEqual(pixel(frame, 10, 3), [120, 120, 125]); // old label gone
    assert.deepEqual(pixel(frame, 10, 5), [10, 60, 120]); // new glyphs in the label's ink
    assert.deepEqual(pixel(frame, 55, 5), [255, 255, 255]); // brighter dialog untouched
  });

  test('leaves the frame alone when the label is not there', () => {
    const frame = frameOf(20, 10, [250, 250, 250]);
    const before = Buffer.from(frame.data);
    assert.equal(replaceText(frame, { x: 0, y: 0, width: 20, height: 10 }, new Float32Array(200).fill(1)), false);
    assert.deepEqual(frame.data, before);
  });
});

describe('frames and shared orgs', () => {
  test('clips a box by its frames and the window', () => {
    const viewport = { x: 0, y: 0, width: 1280, height: 720 };
    assert.deepEqual(clipRect({ x: 100, y: 600, width: 200, height: 200 }, [viewport]), {
      x: 100,
      y: 600,
      width: 200,
      height: 120
    });
    assert.equal(
      clipRect({ x: 10, y: 10, width: 50, height: 50 }, [viewport, { x: 300, y: 0, width: 100, height: 100 }]),
      null
    );
  });

  test('turns words and expressions into one case-insensitive pattern', () => {
    const deny = denyPattern(['Acme Corp.', /globex\s+inc/]);
    const re = new RegExp(deny.source, deny.flags);
    assert.ok(re.test('Opportunity for ACME CORP.'));
    assert.ok(re.test('Globex  Inc'));
    assert.ok(!new RegExp(denyPattern(['a.c']).source).test('abc'));
    assert.equal(denyPattern([]), null);
  });
});

describe('cards template', () => {
  const html = readFileSync(`${skill}assets/cards.html`, 'utf8');

  test('offers the scenes and hooks captureCard relies on', () => {
    for (const scene of ['intro', 'chapter', 'outro']) assert.match(html, new RegExp(`id="${scene}" class="scene"`));
    assert.match(html, /window\.fill = /);
    assert.match(html, /window\.play = /);
  });

  test('holds every animation until play()', () => {
    assert.match(html, /body:not\(\.go\) \*\s*\{\s*animation-play-state: paused !important;/);
  });

  test('lets the recorder set every animation to a time, for frame-exact cards', () => {
    assert.match(html, /window\.seek = /);
    assert.match(html, /a\.currentTime = t \* 1000/);
  });
});
