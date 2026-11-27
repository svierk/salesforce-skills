// Tests the Prototype Pilot's check script without a browser: argument
// parsing, deep-link file names, the overlap and layout checks, flow step
// validation and the preview page. The import itself proves the script loads
// without Chrome, which it only needs once it looks at a prototype.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutFindings,
  list,
  overlaps,
  parseArgs,
  parseSize,
  previewHtml,
  shotName,
  validateStep
} from '../../plugins/prototype-pilot/skills/salesforce-prototype-pilot/scripts/proto-check.mjs';

describe('parseArgs', () => {
  test('reads the command, values and bare flags', () => {
    const a = parseArgs(['shots', '--url', 'http://localhost:5173', '--views', 'home,asset', '--verbose']);
    assert.deepEqual(a._, ['shots']);
    assert.equal(a.url, 'http://localhost:5173');
    assert.equal(a.views, 'home,asset');
    assert.equal(a.verbose, true);
  });

  test('a flag followed by another flag stays a flag', () => {
    assert.deepEqual(parseArgs(['--a', '--b', 'x']), { _: [], a: true, b: 'x' });
  });
});

describe('parseSize and list', () => {
  test('parses window sizes', () => {
    assert.deepEqual(parseSize('1440x900'), { width: 1440, height: 900 });
    assert.deepEqual(parseSize(' 1280x720 '), { width: 1280, height: 720 });
  });

  test('rejects sizes in another format', () => {
    assert.throws(() => parseSize('1440*900'), /1440x900/);
  });

  test('splits and trims lists, drops empty entries', () => {
    assert.deepEqual(list(' home, asset/specs ,,advisor/chat '), ['home', 'asset/specs', 'advisor/chat']);
    assert.deepEqual(list(undefined), []);
  });
});

describe('shotName', () => {
  test('turns deep links into file names', () => {
    assert.equal(shotName('home'), 'home');
    assert.equal(shotName('#guides/ka0Pr005'), 'guides_ka0pr005');
    assert.equal(shotName('#/advisor/chat'), 'advisor_chat');
    assert.equal(shotName(''), 'start');
  });
});

describe('overlaps', () => {
  const phone = { x: 500, y: 60, width: 393, height: 852 };

  test('finds boxes that share an area', () => {
    assert.equal(overlaps(phone, { x: 32, y: 1040, width: 600, height: 40 }), false);
    assert.equal(overlaps(phone, { x: 32, y: 880, width: 600, height: 40 }), true);
  });

  test('touching edges and a missing box are not an overlap', () => {
    assert.equal(overlaps(phone, { x: 893, y: 60, width: 420, height: 852 }), false);
    assert.equal(overlaps(phone, null), false);
  });
});

describe('layoutFindings', () => {
  const size = { width: 1700, height: 940 };

  test('reports a header on top of the phone - the fixed-position bug', () => {
    const found = layoutFindings(size, {
      header: { x: 32, y: 876, width: 560, height: 40 },
      phone: { x: 419, y: 44, width: 393, height: 852 },
      panel: { x: 860, y: 44, width: 420, height: 852 }
    });
    assert.deepEqual(found, ['1700x940: the header overlaps the phone']);
  });

  test('reports a phone that does not fit the window - the transform bug', () => {
    const found = layoutFindings(
      { width: 1280, height: 720 },
      { header: { x: 28, y: 20, width: 1224, height: 40 }, phone: { x: 300, y: 70, width: 393, height: 852 } }
    );
    assert.deepEqual(found, ['1280x720: the phone does not fit the window']);
  });

  test('a clean layout has no findings', () => {
    assert.deepEqual(
      layoutFindings(size, {
        header: { x: 28, y: 20, width: 1644, height: 40 },
        phone: { x: 419, y: 76, width: 393, height: 852 },
        panel: { x: 860, y: 76, width: 420, height: 852 }
      }),
      []
    );
  });
});

describe('validateStep', () => {
  test('accepts every action', () => {
    for (const step of [
      { goto: 'home' },
      { click: 'Accept' },
      { type: { selector: 'input', text: 'hi' } },
      { wait: 500 },
      { expect: 'Welcome' },
      { shot: 'home' }
    ])
      assert.equal(validateStep(step, 0), null);
  });

  test('names the step and the problem', () => {
    assert.match(validateStep({ press: 'Enter' }, 2), /^step 3: needs one of/);
    assert.match(validateStep({ type: 'hello' }, 0), /type needs \{ selector, text \}/);
    assert.match(validateStep({ wait: 'soon' }, 0), /wait needs milliseconds/);
  });
});

describe('previewHtml', () => {
  test('lays out title, logo, phones and captions', () => {
    const html = previewHtml({
      title: 'Acme · Owner App',
      subtitle: 'Clickable prototype',
      logo: '<svg id="logo"></svg>',
      images: ['file:///a.png', 'file:///b.png'],
      captions: ['Home', 'Chat']
    });
    assert.match(html, /<h1>Acme · Owner App<\/h1>/);
    assert.match(html, /<p>Clickable prototype<\/p>/);
    assert.match(html, /<svg id="logo"><\/svg>/);
    assert.equal((html.match(/<figure>/g) ?? []).length, 2);
    assert.match(html, /<figcaption>Chat<\/figcaption>/);
  });

  test('escapes text and leaves out what is not given', () => {
    const html = previewHtml({ title: 'R&D <Lab>', images: ['x.png'] });
    assert.match(html, /<h1>R&amp;D &lt;Lab&gt;<\/h1>/);
    assert.doesNotMatch(html, /class="logo"/);
    assert.doesNotMatch(html, /<figcaption>/);
  });
});
