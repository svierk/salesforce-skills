// Proto Check - looks at a running prototype the way a reviewer would, through
// the installed Google Chrome and its DevTools protocol. No packages needed:
// Node's built-in WebSocket and fetch talk to Chrome directly.
//
//   node proto-check.mjs shots   --url http://localhost:5173 --views invite,home,asset/specs --out shots
//   node proto-check.mjs flow    --url http://localhost:5173 --steps flow.json --out shots
//   node proto-check.mjs preview --url http://localhost:5173 --views invite,home,asset --captions "Invitation,Home,Asset" \
//                                --title "Meridian Aero · Private Client App" --subtitle "Clickable prototype" --out docs/preview.jpg
//
// shots   - one retina crop of the phone per deep link, one desktop screenshot per
//           window size, and layout checks: phone, panel and header must not
//           overlap; no horizontal overflow inside the phone; every image loaded.
// flow    - runs a click path from a JSON file and reports each step.
// preview - composes the README preview: phones side by side under a title.
//
// The selectors follow the Salesforce Prototype Starter (.phone, .viewport,
// .inspector, .desk-bar); pass --phone, --panel, --header to change them.
// Exit code 1 when a check or a step fails.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* ---------- Pure helpers ------------------------------------------------- */

/** `--key value` pairs and bare flags into an object; the first bare word is the command. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** "1440x900" → { width: 1440, height: 900 }. */
export function parseSize(text) {
  const m = /^(\d+)x(\d+)$/.exec(String(text).trim());
  if (!m) throw new Error(`Size must look like 1440x900, got "${text}"`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** Comma-separated list, trimmed, empty entries dropped. */
export const list = (text) =>
  String(text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** A deep link as a file name: "" → invite, "guides/ka0Pr005" → guides_ka0Pr005. */
export const shotName = (view) => (view.replace(/^#\/?/, '').replace(/[^\w-]+/g, '_') || 'start').toLowerCase();

/** True when two DOMRect-like boxes share more than `tolerance` pixels in both directions. */
export function overlaps(a, b, tolerance = 1) {
  if (!a || !b) return false;
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > tolerance && y > tolerance;
}

/** Layout findings for one desktop window size, from the measured boxes. */
export function layoutFindings(size, boxes) {
  const found = [];
  const label = `${size.width}x${size.height}`;
  if (overlaps(boxes.header, boxes.phone)) found.push(`${label}: the header overlaps the phone`);
  if (overlaps(boxes.header, boxes.panel)) found.push(`${label}: the header overlaps the data panel`);
  if (overlaps(boxes.phone, boxes.panel)) found.push(`${label}: the phone overlaps the data panel`);
  for (const [name, box] of Object.entries({ phone: boxes.phone, panel: boxes.panel })) {
    if (!box) continue;
    if (box.x < 0 || box.y < 0 || box.x + box.width > size.width + 1 || box.y + box.height > size.height + 1)
      found.push(`${label}: the ${name} does not fit the window`);
  }
  return found;
}

/** Checks one flow step for a known action before anything runs. */
export function validateStep(step, index) {
  const actions = ['goto', 'click', 'type', 'wait', 'expect', 'shot'];
  const keys = Object.keys(step ?? {});
  const action = keys.find((k) => actions.includes(k));
  if (!action) return `step ${index + 1}: needs one of ${actions.join(', ')}`;
  if (action === 'type' && (typeof step.type !== 'object' || !step.type.selector || step.type.text === undefined))
    return `step ${index + 1}: type needs { selector, text }`;
  if (action === 'wait' && !(Number(step.wait) >= 0)) return `step ${index + 1}: wait needs milliseconds`;
  return null;
}

/** HTML for the README preview: logo, title and subtitle, then the phone crops with captions. */
export function previewHtml({
  title,
  subtitle = '',
  logo = '',
  images,
  captions = [],
  width = 2400,
  phoneHeight = 900
}) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const figures = images
    .map(
      (src, i) =>
        `<figure><img src="${esc(src)}">${captions[i] ? `<figcaption>${esc(captions[i])}</figcaption>` : ''}</figure>`
    )
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${width}px;background:radial-gradient(1400px 700px at 30% 0%,#1d1a15 0%,transparent 60%),#050506;color:#f3f2ef;font-family:var(--font,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif)}
header{display:flex;align-items:center;gap:26px;padding:56px 88px 0}
header .logo{width:112px;display:flex}header .logo>*{width:100%;height:auto}
h1{margin:0;font-weight:400;font-size:34px;letter-spacing:.2em;text-transform:uppercase}
p{margin:8px 0 0;color:#9a9a9f;font-size:20px}
.row{display:flex;justify-content:center;gap:44px;padding:52px 40px 64px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:22px}
figure img{height:${phoneHeight}px;display:block;clip-path:inset(2px round 68px)}
figcaption{font-size:19px;letter-spacing:.18em;text-transform:uppercase;color:#c9c7c1}
</style></head><body>
<header>${logo ? `<div class="logo">${logo}</div>` : ''}<div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div></header>
<div class="row">${figures}</div></body></html>`;
}

/* ---------- Chrome over the DevTools protocol ---------------------------- */

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

export function findChrome() {
  const found = [process.env.CHROME_PATH, ...CHROME_PATHS].find((p) => p && existsSync(p));
  if (!found) throw new Error('Google Chrome not found - set CHROME_PATH to the browser binary.');
  return found;
}

/** Starts a headless Chrome with its own profile and returns a small CDP client for one page. */
export async function openChrome({ port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'proto-check-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch(`http://127.0.0.1:${port}/json`)
      .then((r) => r.json())
      .catch(() => undefined);
  }
  if (!targets) throw new Error('Chrome did not start its DevTools endpoint.');
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? fail(new Error(m.error.message)) : ok(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      pending.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluation failed');
    return r.result?.value;
  };
  const size = (width, height, scale = 1) =>
    send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const goto = async (url, settle = 2000) => {
    await send('Page.navigate', { url });
    await sleep(settle);
  };
  const shot = async (file, clip, format = file.endsWith('.jpg') ? 'jpeg' : 'png') => {
    const r = await send('Page.captureScreenshot', {
      format,
      quality: format === 'jpeg' ? 86 : undefined,
      clip,
      captureBeyondViewport: !!clip
    });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  };
  // wait for Chrome to exit before removing its profile - it writes until the end
  const close = async () => {
    ws.close();
    const exited = new Promise((done) => chrome.once('exit', done));
    chrome.kill();
    await Promise.race([exited, sleep(3000)]);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { send, evaluate, size, goto, shot, close };
}

/** A fresh load of one deep link - a query string forces the reload, the hash picks the view. */
const viewUrl = (base, view) =>
  `${base.replace(/#.*$/, '')}${base.includes('?') ? '&' : '?'}r=${Date.now()}#${view.replace(/^#/, '')}`;

const box = (selector) => `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
  const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`;

/* ---------- Commands ----------------------------------------------------- */

async function shots(args) {
  const out = resolve(args.out ?? 'shots');
  const sel = { phone: args.phone ?? '.phone', panel: args.panel ?? '.inspector', header: args.header ?? '.desk-bar' };
  const views = list(args.views ?? 'home');
  const sizes = list(args.desktop ?? '1920x1080,1440x900,1280x720').map(parseSize);
  const findings = [];
  const page = await openChrome();
  try {
    await page.size(1600, 1100, 2);
    for (const view of views) {
      await page.goto(viewUrl(args.url, view), Number(args.settle ?? 2200));
      const phone = await page.evaluate(box(sel.phone));
      if (!phone) {
        findings.push(`#${view}: no element matches ${sel.phone}`);
        continue;
      }
      const checks = await page.evaluate(`(() => {
        const v = document.querySelector('.viewport') ?? document.querySelector(${JSON.stringify(sel.phone)});
        const overflow = v && v.scrollWidth > v.clientWidth + 1;
        const broken = [...document.querySelectorAll(${JSON.stringify(sel.phone)} + ' img')]
          .filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'));
        return { overflow, broken };
      })()`);
      if (checks.overflow) findings.push(`#${view}: content is wider than the phone (horizontal overflow)`);
      for (const src of checks.broken) findings.push(`#${view}: image did not load - ${src}`);
      const pad = 14;
      const file = await page.shot(join(out, `phone-${shotName(view)}.png`), {
        x: phone.x - pad,
        y: phone.y - pad,
        width: phone.width + 2 * pad,
        height: phone.height + 2 * pad,
        scale: 1
      });
      console.log(`shot   ${file}`);
    }
    for (const s of sizes) {
      await page.size(s.width, s.height, 1);
      await page.goto(viewUrl(args.url, views[0]), Number(args.settle ?? 2200));
      const boxes = {
        phone: await page.evaluate(box(sel.phone)),
        panel: await page.evaluate(box(sel.panel)),
        header: await page.evaluate(box(sel.header))
      };
      findings.push(...layoutFindings(s, boxes));
      console.log(`shot   ${await page.shot(join(out, `desktop-${s.width}x${s.height}.png`))}`);
    }
  } finally {
    await page.close();
  }
  report(findings);
}

async function flow(args) {
  if (!args.steps) throw new Error('flow needs --steps <file.json>');
  const steps = JSON.parse(readFileSync(args.steps, 'utf8'));
  const problems = steps.map(validateStep).filter(Boolean);
  if (problems.length) return report(problems);
  const out = resolve(args.out ?? 'shots');
  const failed = [];
  const page = await openChrome();
  const byText = (text) => `[...document.querySelectorAll('button, a, [role=button], label')]
    .find((e) => e.offsetParent !== null && e.textContent.replace(/\\s+/g, ' ').includes(${JSON.stringify(text)}))`;
  try {
    const { width, height } = parseSize(args.size ?? '1600x1100');
    await page.size(width, height, 1);
    await page.goto(viewUrl(args.url, ''), 1500);
    for (const [i, step] of steps.entries()) {
      const n = `${String(i + 1).padStart(2, ' ')}.`;
      let ok = true;
      let what = '';
      if (step.goto !== undefined) {
        what = `goto #${step.goto}`;
        await page.goto(viewUrl(args.url, step.goto), 1500);
      } else if (step.click) {
        what = `click "${step.click}"`;
        ok = await page.evaluate(
          `(() => { const e = ${byText(step.click)}; if (!e) return false; e.click(); return true; })()`
        );
        await sleep(Number(step.after ?? 600));
      } else if (step.type) {
        what = `type into ${step.type.selector}`;
        ok =
          await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(step.type.selector)}); if (!e) return false;
          const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set; set.call(e, ${JSON.stringify(step.type.text)});
          e.dispatchEvent(new Event('input', { bubbles: true })); ${step.type.submit ? 'e.form?.requestSubmit();' : ''} return true; })()`);
        await sleep(Number(step.after ?? 400));
      } else if (step.wait !== undefined) {
        what = `wait ${step.wait} ms`;
        await sleep(Number(step.wait));
      } else if (step.expect) {
        what = `expect "${step.expect}"`;
        ok = await page.evaluate(`document.body.innerText.includes(${JSON.stringify(step.expect)})`);
      } else if (step.shot) {
        what = `shot ${step.shot}`;
        await page.shot(join(out, `flow-${shotName(step.shot)}.png`));
      }
      console.log(`${n} ${ok ? 'ok  ' : 'FAIL'} ${what}`);
      if (!ok) failed.push(`step ${i + 1}: ${what}`);
    }
  } finally {
    await page.close();
  }
  report(failed);
}

async function preview(args) {
  const views = list(args.views);
  if (!views.length || !args.title) throw new Error('preview needs --views and --title');
  const work = mkdtempSync(join(tmpdir(), 'proto-preview-'));
  const outFile = resolve(args.out ?? 'docs/preview.jpg');
  const page = await openChrome();
  try {
    await page.size(1600, 1100, 2);
    const images = [];
    for (const view of views) {
      await page.goto(viewUrl(args.url, view), Number(args.settle ?? 2200));
      const phone = await page.evaluate(box(args.phone ?? '.phone'));
      if (!phone) throw new Error(`#${view}: no element matches ${args.phone ?? '.phone'}`);
      const pad = 14;
      images.push(
        await page.shot(join(work, `${shotName(view)}.png`), {
          x: phone.x - pad,
          y: phone.y - pad,
          width: phone.width + 2 * pad,
          height: phone.height + 2 * pad,
          scale: 1
        })
      );
    }
    const width = Number(args.width ?? 2400);
    const html = previewHtml({
      title: args.title,
      subtitle: args.subtitle,
      logo: args.logo ? readFileSync(args.logo, 'utf8') : '',
      images: images.map((f) => pathToFileURL(f).href),
      captions: list(args.captions),
      width
    });
    const htmlFile = join(work, 'preview.html');
    writeFileSync(htmlFile, html);
    await page.size(width, 1200, 1);
    await page.goto(pathToFileURL(htmlFile).href, 1500);
    const height = Math.ceil(await page.evaluate('document.body.scrollHeight'));
    await page.size(width, height, 1);
    await sleep(300);
    console.log(`preview ${await page.shot(outFile, { x: 0, y: 0, width, height, scale: 1 })}`);
  } finally {
    await page.close();
    rmSync(work, { recursive: true, force: true });
  }
}

function report(findings) {
  if (findings.length) {
    console.log(`\n${findings.length} finding(s):`);
    for (const f of findings) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else console.log('\nNo findings.');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const command = { shots, flow, preview }[args._[0]];
  if (!command || !args.url) {
    console.error(
      'Usage: node proto-check.mjs <shots|flow|preview> --url <running prototype> [options] - see the header of this file.'
    );
    process.exit(2);
  }
  command(args).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
