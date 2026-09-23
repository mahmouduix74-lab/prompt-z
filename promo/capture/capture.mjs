/**
 * Frame-accurate capture of the real PromptZ site for the web promo.
 *
 * Runs the production build (vite preview on :4173) in headless Chromium with a
 * virtual clock: every timer, rAF and Web Animation advances exactly 1/30 s per
 * frame, so the light and dark runs produce identical states frame for frame and
 * the composition can wipe between them. Interactions (cursor, clicks, typing,
 * select, snake d-pad) follow src/web/timeline.json.
 *
 * Usage: node capture/capture.mjs <light|dark> [lastFrame] [firstShot]
 * Output: public/capture/<theme>/f0000.jpg … and public/capture/meta-<theme>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const TL = JSON.parse(fs.readFileSync(path.join(root, 'src/web/timeline.json'), 'utf8'));
const theme = process.argv[2];
if (theme !== 'light' && theme !== 'dark') throw new Error('theme must be light or dark');

// ---- Macro passes -------------------------------------------------------------------
// MACRO=<id> re-shoots one region at 4× for the close-ups named in the timeline.
const MACRO = process.env.MACRO ? TL.macros.find((m) => m.id === process.env.MACRO) : null;
if (process.env.MACRO && !MACRO) throw new Error('unknown macro ' + process.env.MACRO);
if (MACRO && !MACRO.themes.includes(theme)) throw new Error(`macro ${MACRO.id} is not shot in ${theme}`);

const FPS = TL.fps;
const defaultLast = Math.round(TL.outro.start * FPS) + 18;
const lastFrame = MACRO ? Math.round(MACRO.to * FPS) : Number(process.argv[3] ?? defaultLast);
// Frames before this are replayed (so the state is identical) but not re-shot.
const firstShot = MACRO ? Math.round(MACRO.from * FPS) : Number(process.argv[4] ?? 0);
const outDir = process.env.MACRO
  ? path.join(root, 'public/capture/macro', `${process.env.MACRO}-${theme}`)
  : path.join(root, 'public/capture', theme);
fs.mkdirSync(outDir, { recursive: true });

const SITE = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const VW = TL.viewport.width;
const VH = TL.viewport.height;

// ---- Fonts --------------------------------------------------------------------
// The site's body stack is -apple-system / SF Pro; on this Linux box those resolve to
// nothing, so alias the SF names to Inter (Latin). Arabic typed into the prompt box is set in
// Cairo (the second face in the site's Arabic stack, src/index.css). IBM Plex Sans Arabic, the
// Arabic hero face, is loaded too since the site's own <link> doesn't include it. Clash Display (titles) comes
// from api.fontshare.com, which is blocked here, so it is served from the promo's own copy.
const googleCss = fs.readFileSync(path.join(here, 'google-fonts.css'), 'utf8');
const faces = googleCss.split('@font-face').slice(1).map((b) => '@font-face' + b.split('}')[0] + '}');
const alias = (families, pick) =>
  faces
    .filter(pick)
    .flatMap((f) => families.map((name) => f.replace(/font-family: '[^']+'/, `font-family: '${name}'`)))
    .join('\n');
const SF = ['SF Pro Text', 'SF Pro Display', 'SF Pro', 'BlinkMacSystemFont'];
const fontCss = [
  googleCss,
  alias(SF, (f) => f.includes("'Inter'")),
  ":root{--font-sans:'SF Pro Text','Cairo',ui-sans-serif,sans-serif;}",
].join('\n');
const clashCss = [600, 700]
  .map(
    (w) =>
      `@font-face{font-family:'Clash Display';font-weight:${w === 600 ? '500 600' : '700 900'};font-style:normal;font-display:block;src:url(https://fonts.local/ClashDisplay-${w === 600 ? 'Semibold' : 'Bold'}.woff2) format('woff2');}`,
  )
  .join('\n');

// ---- Snake plan -----------------------------------------------------------------
// Snake starts at (8,8) heading right with food at (12,8). Foods after that are fixed so the
// d-pad presses below always land them: up the column, then left along the row.
const FOODS = [
  [12, 4],
  [8, 4],
  [8, 11],
  [3, 11],
];
const snakeQueue = FOODS.flatMap(([x, y]) => [(x + 0.5) / 16, (y + 0.5) / 16]);
const tick = TL.snakeTickMs / 1000;
const gen = TL.clicks.generate;
const dpad = [
  { dir: 'Up', at: gen + 4 * tick + tick * 0.5 },
  { dir: 'Left', at: gen + 8 * tick + tick * 0.5 },
];

// ---- Cursor path ----------------------------------------------------------------
// Waypoints in video seconds. A target is resolved (against the live DOM) when the
// cursor sets off towards it, so rects are always post-scroll.
const sel = {
  toggle: 'header button[aria-label="Appearance"]',
  general: '#prompt-builder button:nth-of-type(1)',
  domain: '#prompt-builder button:nth-of-type(2)',
  depth: '#prompt-builder button[aria-pressed]:nth-of-type(3)',
  medium: '#prompt-builder button[aria-pressed]:nth-of-type(2)',
  textarea: '#raw-prompt',
  select: '#output-language',
  generate: '#prompt-builder button[title^="Shortcut"]',
  up: 'button[aria-label="Up"]',
  copy: '#prompt-builder button[title="Copy"]',
  download: '#prompt-builder button[title="Download .md"]',
  history: '#prompt-builder button[aria-label="Saved Library"]',
  drawerClose: '.fixed.inset-0.z-50 button:has(svg.lucide-x)',
  language: 'header button[aria-label="Language"]',
  left: 'button[aria-label="Left"]',
};
const C = TL.clicks;
const waypoints = [
  { t: 5.1, pt: [1290, 230] },
  { t: 6.3, sel: sel.toggle },
  { t: 7.3, sel: sel.toggle },
  // The UI language: to Arabic (the page mirrors to RTL), a look, then back to English.
  { t: C.language - 0.12, sel: sel.language },
  { t: C.language + 0.3, sel: sel.language },
  { t: C.language + 0.8, pt: [760, 330] },
  { t: C.languageBack - 0.5, pt: [760, 330] },
  { t: C.languageBack - 0.08, sel: sel.language },
  { t: C.languageBack + 0.25, sel: sel.language },
  { t: TL.scroll.start - 0.1, pt: [1010, 470] },
  { t: TL.scroll.end, pt: [1010, 470] },
  // Glide over "General", then across to UI/UX Design.
  { t: C.domain - 0.4, sel: sel.general },
  { t: C.domain - 0.28, sel: sel.general },
  { t: C.domain - 0.05, sel: sel.domain },
  { t: C.domain + 0.12, sel: sel.domain },
  // Down to the depth tabs: rest on Medium, then pick Detailed.
  { t: C.depth - 0.4, sel: sel.medium },
  { t: C.depth - 0.3, sel: sel.medium },
  { t: C.depth - 0.05, sel: sel.depth },
  { t: C.depth + 0.12, sel: sel.depth },
  { t: C.textarea - 0.05, sel: sel.textarea, fx: 0.62, fy: 0, dy: 70 },
  { t: C.textarea + 0.1, sel: sel.textarea, fx: 0.62, fy: 0, dy: 70 },
  { t: TL.typing.start + 0.45, sel: sel.textarea, fx: 0.45, fy: 0, dy: 190 },
  { t: TL.typing.end + 0.05, sel: sel.textarea, fx: 0.45, fy: 0, dy: 190 },
  { t: C.select - 0.05, sel: sel.select, fx: 0.32 },
  { t: C.select + 0.25, sel: sel.select, fx: 0.32 },
  // Onto the "English" row of the drop-down drawn by the composition (3rd row below the select).
  { t: C.selectPick - 0.08, sel: sel.select, fx: 0.32, fy: 1, dy: 8 + 30 * 2.5 },
  { t: C.selectPick + 0.1, sel: sel.select, fx: 0.32, fy: 1, dy: 8 + 30 * 2.5 },
  { t: C.generate - 0.05, sel: sel.generate },
  { t: C.generate + 0.25, sel: sel.generate },
  { t: dpad[0].at - 0.12, sel: sel.up },
  { t: dpad[0].at + 0.2, sel: sel.up },
  { t: dpad[1].at - 0.12, sel: sel.left },
  { t: dpad[1].at + 0.3, sel: sel.left },
  // Rest beside the result while it streams, out of the text's way.
  { t: TL.resultAt + 0.3, sel: sel.left, dx: -150, dy: 60 },
  { t: C.copy - 0.5, sel: sel.left, dx: -150, dy: 60 },
  // The features after the result: Copy, Download .md, History, then the UI language.
  { t: C.copy - 0.08, sel: sel.copy },
  { t: C.copy + 0.25, sel: sel.copy },
  { t: C.download - 0.1, sel: sel.download },
  { t: C.download + 0.25, sel: sel.download },
  { t: C.history - 0.1, sel: sel.history },
  { t: C.history + 0.9, sel: sel.history },
  { t: C.drawerClose - 0.08, sel: sel.drawerClose },
  { t: C.drawerClose + 0.2, sel: sel.drawerClose },
  { t: TL.outro.start + 1, sel: sel.drawerClose, dx: -200, dy: 200 },
];
const realClicks = [
  { t: C.copy, sel: sel.copy },
  { t: C.download, sel: sel.download },
  { t: C.history, sel: sel.history },
  { t: C.drawerClose, sel: sel.drawerClose },
  { t: C.language, sel: sel.language },
  { t: C.languageBack, sel: sel.language },
  { t: C.domain, sel: sel.domain },
  { t: C.depth, sel: sel.depth },
  { t: C.textarea, sel: sel.textarea },
  { t: C.generate, sel: sel.generate },
  ...dpad.map((d) => ({ t: d.at, sel: sel[d.dir.toLowerCase()] })),
];
// Clicks the composition shows but the capture must not perform (theme toggles, the native select).
const shownClicks = [
  { t: TL.theme[1].at, kind: 'toggle' },
  { t: C.domain, kind: 'real' },
  { t: C.depth, kind: 'real' },
  { t: C.textarea, kind: 'real' },
  { t: C.select, kind: 'select' },
  { t: C.selectPick, kind: 'pick' },
  { t: C.generate, kind: 'real' },
  ...dpad.map((d) => ({ t: d.at, kind: 'real' })),
  { t: C.copy, kind: 'real' },
  { t: C.download, kind: 'download' },
  { t: C.history, kind: 'real' },
  { t: C.drawerClose, kind: 'real' },
  { t: C.language, kind: 'real' },
  { t: C.languageBack, kind: 'real' },
];

// ---- Typing -----------------------------------------------------------------------
// A human rhythm: uneven key gaps, a longer beat after each space, and one slip (a wrong
// letter noticed, erased, retyped) inside the word the timeline names. Deterministic.
const keystrokes = (() => {
  const { start, end, typo } = TL.typing;
  const words = TL.idea.split(' ');
  let seed = 0x51f15e;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const keys = [];
  words.forEach((word, wi) => {
    Array.from(word).forEach((ch, ci) => {
      if (typo && wi === typo.word && ci === typo.at) {
        keys.push({ key: typo.wrong, w: 0.9 + rnd() * 0.4 });
        keys.push({ key: 'Backspace', w: 2.6 });
        keys.push({ key: ch, w: 1.3 });
        return;
      }
      keys.push({ key: ch, w: 0.7 + rnd() * 0.6 });
    });
    if (wi < words.length - 1) keys.push({ key: ' ', w: 1.6 + rnd() * 0.5 });
  });
  const total = keys.reduce((n, k) => n + k.w, 0);
  let acc = 0;
  return keys.map((k) => {
    acc += k.w;
    return { key: k.key, t: +(start + ((acc - k.w * 0.5) / total) * (end - start)).toFixed(4) };
  });
})();


const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const scrollEase = (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: MACRO ? 4 : 2,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'Africa/Cairo',
    colorScheme: theme,
    reducedMotion: 'no-preference',
  });

  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(SITE).origin });

  let releaseResult;
  const resultGate = new Promise((r) => (releaseResult = r));
  await context.route('**/api/models', (r) =>
    r.fulfill({ json: { models: [{ id: 'gemini-3.8-flash', name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' }] } }),
  );
  await context.route('**/api/generate', async (r) => {
    await resultGate;
    await r.fulfill({ json: { result: TL.result } });
  });
  // Google Fonts (the site's own <link> and the aliases above) go through a disk cache, so a
  // flaky connection can't leave a run with a fallback face.
  const fontCache = path.join(here, '.font-cache');
  fs.mkdirSync(fontCache, { recursive: true });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (r) => {
    const url = r.request().url();
    const file = path.join(fontCache, Buffer.from(url).toString('base64url').slice(-120));
    if (!fs.existsSync(file)) {
      for (let i = 0; ; i++) {
        try {
          const res = await r.fetch();
          if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
          fs.writeFileSync(file, await res.body());
          fs.writeFileSync(file + '.type', res.headers()['content-type'] || '');
          break;
        } catch (e) {
          if (i >= 5) throw e;
          await new Promise((res) => setTimeout(res, 800));
        }
      }
    }
    await r.fulfill({ contentType: fs.readFileSync(file + '.type', 'utf8'), body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route('https://api.fontshare.com/**', (r) => r.fulfill({ contentType: 'text/css', body: clashCss }));
  await context.route('https://fonts.local/**', (r) =>
    r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(root, 'public/fonts', path.basename(new URL(r.request().url()).pathname))) }),
  );
  // Make the snake deterministic and slower: food positions from the plan above, tick from the timeline.
  await context.route(/\/assets\/index-.*\.js$/, async (r) => {
    const res = await r.fetch();
    let js = await res.text();
    const before = js;
    js = js.replace(
      /\{x:Math\.floor\(Math\.random\(\)\*(\w+)\),y:Math\.floor\(Math\.random\(\)\*\1\)\}/,
      '{x:Math.floor(window.__snakeRand()*$1),y:Math.floor(window.__snakeRand()*$1)}',
    );
    js = js.replace('},145)', '},window.__snakeTick||145)');
    if (js === before) throw new Error('snake patch did not apply');
    await r.fulfill({ response: res, body: js });
  });

  await context.addInitScript(
    ({ theme, queue, tickMs, fontCss }) => {
      let s = 0x2f6b1d3;
      const rnd = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      Math.random = rnd;
      const q = queue.slice();
      window.__snakeRand = () => (q.length ? q.shift() : rnd());
      window.__snakeTick = tickMs;
      try {
        localStorage.clear();
        localStorage.setItem('theme_preference', theme);
        localStorage.setItem('app_language_preference', 'en');
        localStorage.setItem('snake_high_score', '0');
      } catch {}
      // Drive every CSS animation / transition / WAAPI animation from the virtual clock.
      window.__sync = (vt) => {
        for (const a of document.getAnimations()) {
          if (a.__v0 === undefined) {
            a.__v0 = vt;
            a.pause();
          }
          const ct = vt - a.__v0;
          const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
          if (Number.isFinite(end) && ct >= end) {
            if (a.playState !== 'finished') a.finish();
          } else {
            if (a.playState !== 'paused') a.pause();
            a.currentTime = ct;
          }
        }
      };
      const inject = () => {
        if (document.getElementById('__promo-fonts')) return;
        const st = document.createElement('style');
        st.id = '__promo-fonts';
        st.textContent = fontCss;
        (document.head || document.documentElement).appendChild(st);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
      else inject();
    },
    { theme, queue: snakeQueue, tickMs: TL.snakeTickMs, fontCss },
  );

  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.clock.install({ time: new Date('2026-09-22T19:43:00+03:00') });
  await page.clock.pauseAt(new Date('2026-09-22T19:43:00+03:00'));
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  // Load the Arabic face up front so the first typed letter never paints in a fallback.
  for (let i = 0; ; i++) {
    try {
      await page.evaluate((idea) => document.fonts.load("400 14px 'Cairo'", idea).then((f) => f.length > 0), TL.idea);
      break;
    } catch (e) {
      if (i >= 4) throw e;
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(1500);

  const flush = async () => {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(
        () =>
          new Promise((r) => {
            const c = new MessageChannel();
            c.port1.onmessage = () => r(true);
            c.port2.postMessage(0);
          }),
      );
    }
  };
  const rectOf = (s) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, s);
  // Last rect seen per selector: the snake d-pad unmounts when the result arrives, and the
  // cursor's resting point is still defined relative to where it was.
  const lastRect = new Map();
  const resolve = async (wp) => {
    if (wp.pt) return wp.pt;
    const r = (await rectOf(wp.sel)) ?? lastRect.get(wp.sel);
    if (!r) throw new Error('missing ' + wp.sel);
    lastRect.set(wp.sel, r);
    return [r.x + r.w * (wp.fx ?? 0.5) + (wp.dx ?? 0), r.y + r.h * (wp.fy ?? 0.5) + (wp.dy ?? 0)];
  };

  // Containers the close-ups frame: the input panel, the domain chip row, the depth tabs.
  const anchorRect = (anchor) =>
    page.evaluate(
      ({ anchor, sel }) => {
        const el =
          anchor === 'input'
            ? document.querySelector('#raw-prompt').closest('.rounded-2xl')
            : anchor === 'chips'
              ? document.querySelector(sel.domain).parentElement
              : anchor === 'depth'
                ? document.querySelector(sel.depth).parentElement
                : document.querySelector(sel[anchor]);
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      },
      { anchor, sel },
    );

  // Region a macro pass shoots, in viewport px, kept inside the viewport.
  const macroRect = async (m) => {
    if (m.rect) return m.rect;
    const a = await anchorRect(m.anchor);
    const x0 = m.anchor === 'input' ? a.x - (m.pad ?? 0) : a.x + a.w / 2 - m.w / 2;
    const y0 = m.anchor === 'input' ? a.y - (m.pad ?? 0) : a.y + a.h / 2 - m.h / 2;
    const x = Math.round(Math.max(0, Math.min(VW - m.w, x0)));
    const y = Math.round(Math.max(0, Math.min(VH - m.h, y0)));
    return { x, y, w: m.w, h: m.h };
  };

  // Scroll target: the console card plus the mascot's 100px stage clear of the sticky header.
  const scrollTarget = await page.evaluate(() => {
    const card = document.querySelector('#prompt-builder .rounded-3xl');
    return Math.round(card.getBoundingClientRect().top + window.scrollY - 72 - 100 - 14);
  });

  const warmMs = Math.round(TL.warmup * 1000);
  let clockMs = 0;
  await page.clock.runFor(warmMs);
  clockMs = warmMs;

  const meta = { theme, fps: FPS, viewport: TL.viewport, scrollTarget, frames: [], rects: {}, clicks: shownClicks, foods: FOODS, keys: keystrokes };
  let typedCount = 0;
  let macroClip = null;
  let segIndex = -1;
  let segFrom = null;
  let segTo = null;
  let mouseShown = false;
  let pickedLanguage = false;
  let released = false;
  const clicksDone = new Set();

  for (let f = 0; f <= lastFrame; f++) {
    const t = f / FPS;
    const target = warmMs + Math.round(t * 1000);
    if (target > clockMs) {
      await page.clock.runFor(target - clockMs);
      clockMs = target;
    }

    // Scroll
    const sp = Math.min(1, Math.max(0, (t - TL.scroll.start) / (TL.scroll.end - TL.scroll.start)));
    const scrollY = Math.round(scrollEase(sp) * scrollTarget);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);

    // Cursor
    let mouse = null;
    if (t >= waypoints[0].t) {
      let i = waypoints.length - 1;
      while (i > 0 && waypoints[i].t > t) i--;
      if (i !== segIndex) {
        segIndex = i;
        segFrom = await resolve(waypoints[i]);
        segTo = i + 1 < waypoints.length ? await resolve(waypoints[i + 1]) : segFrom;
      }
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const k = b ? easeInOut(Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
      mouse = [segFrom[0] + (segTo[0] - segFrom[0]) * k, segFrom[1] + (segTo[1] - segFrom[1]) * k];
      await page.mouse.move(mouse[0], mouse[1]);
      mouseShown = true;
    }

    // Real clicks
    for (const c of realClicks) {
      if (!clicksDone.has(c) && t >= c.t) {
        clicksDone.add(c);
        const [x, y] = mouse ?? (await resolve({ sel: c.sel }));
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.up();
        if (c.sel === sel.generate) meta.rects.generateAt = t;
      }
    }

    // Typing
    while (typedCount < keystrokes.length && keystrokes[typedCount].t <= t) {
      const { key } = keystrokes[typedCount];
      if (key === 'Backspace') await page.keyboard.press('Backspace');
      else await page.keyboard.insertText(key);
      typedCount++;
    }

    // Output language
    if (!pickedLanguage && t >= C.selectPick) {
      pickedLanguage = true;
      await page.selectOption(sel.select, 'en');
    }

    // Result
    if (!released && t >= TL.resultAt) {
      released = true;
      releaseResult();
      for (let i = 0; i < 100; i++) {
        const done = await page.evaluate(() => !document.querySelector('button[aria-label="Up"]'));
        if (done) break;
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    await flush();
    await page.evaluate((vt) => window.__sync(vt), clockMs);
    await flush();

    // Rects the composition needs (camera targets, drop-down, reveal origin).
    const snap = async (name, s) => {
      meta.rects[name] = await rectOf(s);
    };
    if (f === 0) {
      await snap('toggle', sel.toggle);
      await snap('heroTitle', '#hero-title');
      await snap('header', 'header');
      await snap('language', sel.language);
    }
    if (t >= TL.scroll.end && !meta.rects.card) {
      await snap('card', '#prompt-builder .rounded-3xl');
      await snap('domain', sel.domain);
      await snap('select', sel.select);
      await snap('controls', '#prompt-builder .rounded-2xl');
      meta.rects.inputPanel = await page.evaluate(() => {
        const r = document.querySelector('#raw-prompt').closest('.rounded-2xl').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      meta.rects.outputPanel = await page.evaluate(() => {
        const r = document.querySelector('#raw-prompt').closest('.grid').children[1].getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      await snap('generate', sel.generate);
      meta.rects.chips = await anchorRect('chips');
      meta.rects.depth = await anchorRect('depth');
      await snap('toggleScrolled', sel.toggle);
    }
    if (t >= TL.resultAt + 1 && !meta.rects.copy) {
      await snap('copy', sel.copy);
      await snap('download', sel.download);
      await snap('history', sel.history);
    }
    if (t >= C.history + 0.8 && !meta.rects.drawer) {
      meta.rects.drawer = await page.evaluate(() => {
        const d = document.querySelector('.fixed.inset-0.z-50 button:has(svg.lucide-x)');
        const panel = d && d.closest('.fixed.inset-0.z-50').lastElementChild;
        const r = (panel || d).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
    }
    if (t >= C.generate + 0.5 && !meta.rects.snake) {
      await snap('snake', '#prompt-builder canvas');
      await snap('up', sel.up);
    }

    // Where the typed text ends (the caret, for the tracking close-up) and how far the streamed
    // result reaches (for the shot that follows it down).
    const track = await page.evaluate(() => {
      const ta = document.querySelector('#raw-prompt');
      const out = { caret: null, outBottom: null };
      if (ta && ta.value) {
        const cs = getComputedStyle(ta);
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const r = ta.getBoundingClientRect();
        const w = ctx.measureText(ta.value).width;
        out.caret = [r.right - parseFloat(cs.paddingRight) - w, r.top + parseFloat(cs.paddingTop) + parseFloat(cs.lineHeight) / 2];
      }
      const panel = ta && ta.closest('.grid') && ta.closest('.grid').children[1];
      const text = panel && panel.querySelector('.whitespace-pre-wrap.font-mono');
      if (text && !panel.querySelector('canvas')) out.outBottom = text.getBoundingClientRect().bottom;
      return out;
    });
    meta.frames.push({
      t: +t.toFixed(4),
      scrollY,
      mouse: mouseShown && mouse ? mouse.map((v) => +v.toFixed(1)) : null,
      caret: track.caret ? track.caret.map((v) => +v.toFixed(1)) : null,
      outBottom: track.outBottom === null ? null : +track.outBottom.toFixed(1),
    });

    if (f >= firstShot) {
      const file = path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`);
      if (MACRO) {
        if (!macroClip) {
          macroClip = await macroRect(MACRO);
          fs.writeFileSync(`${outDir}.json`, JSON.stringify({ ...MACRO, rect: macroClip }, null, 1));
        }
        // The caret is only shown in the typing close-up: while keys land it stays solid.
        const caret = MACRO.id === 'typing' && t <= TL.typing.end + 0.1 ? 'initial' : 'hide';
        await page.screenshot({ path: file, type: 'jpeg', quality: 92, caret, clip: { x: macroClip.x, y: macroClip.y, width: macroClip.w, height: macroClip.h } });
      } else {
        await page.screenshot({ path: file, type: 'jpeg', quality: 90, caret: 'hide' });
      }
    }
    if (f % 30 === 0) console.log(`[${theme}] frame ${f}/${lastFrame}`);
  }

  // Only the run that reaches the end writes the meta, so split runs cannot leave a partial one.
  if (lastFrame >= defaultLast) fs.writeFileSync(path.join(root, 'public/capture', `meta-${theme}.json`), JSON.stringify(meta, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
