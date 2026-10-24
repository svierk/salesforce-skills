// Tests the Demo Designer's recorder library without a browser or ffmpeg: the
// timing of frames, the cross-fade graph, subtitles and chapter marks. The
// import itself proves the library loads without playwright-core and
// ffmpeg-static, which it only needs once it records.

import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapters,
  concatList,
  crossfadeGraph,
  joinCues,
  outputSize,
  plain,
  sceneOffsets,
  srt,
  totalDuration
} from '../../plugins/demo-designer/skills/salesforce-demo-designer/scripts/demo-kit.mjs';

const skill = new URL('../../plugins/demo-designer/skills/salesforce-demo-designer/', import.meta.url).pathname;

/** The entries of a concat list as [file, duration] pairs; the repeated last file has no duration. */
function entries(list) {
  const lines = list.trim().split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const file = lines[i].match(/^file '(.+)'$/)[1];
    const duration = lines[i + 1]?.startsWith('duration') ? Number(lines[++i].split(' ')[1]) : undefined;
    out.push([file, duration]);
  }
  return out;
}

describe('outputSize', () => {
  test('multiplies the viewport by the scale', () => {
    assert.deepEqual(outputSize({ width: 1280, height: 720, scale: 1.5 }), { width: 1920, height: 1080 });
    assert.deepEqual(outputSize({ width: 1600, height: 900, scale: 1.2 }), { width: 1920, height: 1080 });
  });

  test('rounds to even numbers, as H.264 needs', () => {
    assert.deepEqual(outputSize({ width: 901, height: 901, scale: 1 }), { width: 902, height: 902 });
  });
});

describe('concatList', () => {
  const frames = [
    { file: 'a.jpg', t: 9.5 },
    { file: 'b.jpg', t: 10.2 },
    { file: 'c.jpg', t: 11 },
    { file: 'd.jpg', t: 13.5 }
  ];

  test('shows every frame until the next one, from the start of the scene', () => {
    assert.deepEqual(entries(concatList(frames, 10, 12)), [
      ['a.jpg', 0.2],
      ['b.jpg', 0.8],
      ['c.jpg', 1],
      ['c.jpg', undefined]
    ]);
  });

  test('adds up to the length of the scene', () => {
    const total = entries(concatList(frames, 10, 12)).reduce((sum, [, d]) => sum + (d ?? 0), 0);
    assert.ok(Math.abs(total - 2) < 1e-3);
  });

  test('keeps the last frame before the start when the page did not change', () => {
    assert.deepEqual(entries(concatList([{ file: 'still.jpg', t: 3 }], 5, 8)), [
      ['still.jpg', 3],
      ['still.jpg', undefined]
    ]);
  });

  test('drops frames that arrive after the end', () => {
    assert.ok(!concatList(frames, 10, 12).includes('d.jpg'));
  });

  test('refuses a scene without frames', () => {
    assert.throws(() => concatList([], 0, 1), /No frames/);
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
});
