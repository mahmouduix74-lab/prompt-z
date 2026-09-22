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

const FPS = TL.fps;
const defaultLast = Math.round(TL.outro.start * FPS) + 18;
const lastFrame = Number(process.argv[3] ?? defaultLast);
// Frames before this are replayed (so the state is identical) but not re-shot.
const firstShot = Number(process.argv[4] ?? 0);
const outDir = path.join(root, 'public/capture', theme);
fs.mkdirSync(outDir, { recursive: true });

const SITE = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const VW = TL.viewport.width;
const VH = TL.viewport.height;

// ---- Fonts --------------------------------------------------------------------
// The site's body stack is -apple-system / SF Pro; on this Linux box those resolve to
// nothing, so alias the SF names to Inter (Latin). Arabic typed into the prompt box is set in
// Cairo (the second face in the site's Arabic stack, src/index.css). Clash Display (titles) comes
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
  domain: '#prompt-builder button:nth-of-type(2)',
  textarea: '#raw-prompt',
  select: '#output-language',
  generate: '#prompt-builder button[title^="Shortcut"]',
  up: 'button[aria-label="Up"]',
  left: 'button[aria-label="Left"]',
};
const C = TL.clicks;
const waypoints = [
  { t: 5.1, pt: [1290, 230] },
  { t: 6.3, sel: sel.toggle },
  { t: 7.3, sel: sel.toggle },
  { t: 8.3, pt: [1010, 470] },
  { t: 9.3, pt: [1010, 470] },
  { t: C.domain - 0.05, sel: sel.domain },
  { t: C.domain + 0.1, sel: sel.domain },
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
  { t: TL.resultAt + 0.2, sel: sel.left, dx: -150, dy: 40 },
  { t: 20.0, sel: sel.left, dx: -150, dy: 40 },
  { t: TL.theme[2].at - 0.2, sel: sel.toggle },
  { t: 21.6, sel: sel.toggle },
  { t: 22.4, pt: [1180, 330] },
];
const realClicks = [
  { t: C.domain, sel: sel.domain },
  { t: C.textarea, sel: sel.textarea },
  { t: C.generate, sel: sel.generate },
  ...dpad.map((d) => ({ t: d.at, sel: sel[d.dir.toLowerCase()] })),
];
// Clicks the composition shows but the capture must not perform (theme toggles, the native select).
const shownClicks = [
  { t: TL.theme[1].at, kind: 'toggle' },
  { t: C.domain, kind: 'real' },
  { t: C.textarea, kind: 'real' },
  { t: C.select, kind: 'select' },
  { t: C.selectPick, kind: 'pick' },
  { t: C.generate, kind: 'real' },
  ...dpad.map((d) => ({ t: d.at, kind: 'real' })),
  { t: TL.theme[2].at, kind: 'toggle' },
];

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const scrollEase = (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'Africa/Cairo',
    colorScheme: theme,
    reducedMotion: 'no-preference',
  });

  let releaseResult;
  const resultGate = new Promise((r) => (releaseResult = r));
  await context.route('**/api/models', (r) =>
    r.fulfill({ json: { models: [{ id: 'gemini-3.8-flash', name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' }] } }),
  );
  await context.route('**/api/generate', async (r) => {
    await resultGate;
    await r.fulfill({ json: { result: TL.result } });
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

  // Scroll target: the console card plus the mascot's 100px stage clear of the sticky header.
  const scrollTarget = await page.evaluate(() => {
    const card = document.querySelector('#prompt-builder .rounded-3xl');
    return Math.round(card.getBoundingClientRect().top + window.scrollY - 72 - 100 - 14);
  });

  const warmMs = Math.round(TL.warmup * 1000);
  let clockMs = 0;
  await page.clock.runFor(warmMs);
  clockMs = warmMs;

  const meta = { theme, fps: FPS, viewport: TL.viewport, scrollTarget, frames: [], rects: {}, clicks: shownClicks, foods: FOODS };
  const ideaChars = Array.from(TL.idea);
  let typedCount = 0;
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
    if (t >= TL.typing.start) {
      const want = Math.min(ideaChars.length, Math.floor(((t - TL.typing.start) / (TL.typing.end - TL.typing.start)) * ideaChars.length));
      while (typedCount < want) {
        await page.keyboard.insertText(ideaChars[typedCount]);
        typedCount++;
      }
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
      await snap('toggleScrolled', sel.toggle);
    }
    if (t >= C.generate + 0.5 && !meta.rects.snake) {
      await snap('snake', '#prompt-builder canvas');
      await snap('up', sel.up);
    }

    meta.frames.push({ t: +t.toFixed(4), scrollY, mouse: mouseShown && mouse ? mouse.map((v) => +v.toFixed(1)) : null });
    if (f >= firstShot) await page.screenshot({ path: path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90, caret: 'hide' });
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
