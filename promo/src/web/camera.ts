import { BAR, STAGE, TL, WIN, caretAt, clamp01, easeInOut, easeOutExpo, outBottomAt, rect } from './timing';

/*
 * Shot list. Continuous moves in the hero and while typing; hard cuts on the music's beat
 * (100 bpm → 0.6 s) everywhere else. A stop marked `cut` jumps there instead of travelling.
 */

/** The window-space point placed at the frame centre, and the zoom. */
export type Shot = { cx: number; cy: number; z: number };
type Stop = { t: number; shot: Shot | ((t: number) => Shot); cut?: boolean; ease?: (x: number) => number };

const C = TL.clicks;
const wide: Shot = { cx: WIN.width / 2, cy: WIN.height / 2, z: 1 };

// Viewport rects (captured after the page scrolled to the console) → window space (+BAR).
const hero = rect('heroTitle');
const toggle = rect('toggle');
const input = rect('inputPanel');
const output = rect('outputPanel');
const chips = rect('chips');
const depth = rect('depth');
const select = rect('select');
const generate = rect('generate');
const snake = rect('snake');

const heroShot = (z: number, dx = 0): Shot => ({ cx: hero.x + hero.w / 2 + dx, cy: BAR + hero.y + hero.h / 2 + 30, z });

// Typing close-up: keeps the caret a little right of centre so the text being written is in view.
const typing = (t: number): Shot => {
  // Caret x averaged over ±0.4 s, so the camera glides with the words instead of per key.
  const xs: number[] = [];
  for (let d = -0.4; d <= 0.4; d += 1 / 30) {
    const c = caretAt(Math.min(t + d, TL.typing.end + 0.05));
    if (c) xs.push(c[0]);
  }
  const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length + 150 : input.x + input.w - 260;
  return { cx: Math.min(input.x + input.w - 300, x), cy: BAR + input.y + 170, z: 2.35 };
};

// Result: frame the panel's top, then follow the streamed text down as it grows, and hold.
const result = (t: number): Shot => {
  const b = outBottomAt(t);
  const top = BAR + output.y + 300;
  return { cx: output.x + output.w / 2, cy: b ? Math.max(top, BAR + b - 170) : top, z: 1.62 };
};

export const CUTS: number[] = TL.cuts;
const [, CUT_LANGUAGE, CUT_DEPTH, CUT_TYPING, CUT_SELECT, CUT_GENERATE, CUT_SNAKE, CUT_ACTIONS] = CUTS;
const copy = rect('copy');
const download = rect('download');
const history = rect('history');
const language = rect('language');
const drawer = rect('drawer');

const stops: Stop[] = [
  { t: 0, shot: wide },
  { t: 1.3, shot: wide },
  { t: 4.0, shot: heroShot(1.72), ease: easeInOut },
  { t: 5.4, shot: heroShot(1.84, -40) },
  // Cut: the header's theme toggle, very close, as the cursor arrives.
  { t: 5.4, shot: { cx: toggle.x + toggle.w / 2 - 120, cy: BAR + toggle.y + 120, z: 3 }, cut: true },
  { t: TL.theme[1].at, shot: { cx: toggle.x + toggle.w / 2 - 120, cy: BAR + toggle.y + 120, z: 3.1 } },
  // …and pull all the way out while the dark theme floods the page.
  { t: TL.theme[1].at + 1.2, shot: wide, ease: easeInOut },
  { t: CUT_LANGUAGE, shot: wide },
  // Cut: the language toggle, very close; the page turns Arabic (RTL) and the camera pulls out,
  // then the wide shot holds while it switches back to English.
  { t: CUT_LANGUAGE, shot: { cx: language.x + language.w / 2 - 60, cy: BAR + language.y + 120, z: 3 }, cut: true },
  { t: C.language + 0.1, shot: { cx: language.x + language.w / 2 - 60, cy: BAR + language.y + 120, z: 3.1 } },
  { t: C.language + 1.1, shot: wide, ease: easeInOut },
  { t: TL.scroll.end, shot: wide },
  // Domain chips, close: the cursor glides over General and picks UI/UX Design. (The row's box
  // spans the whole card, so the shot is framed from its left edge.)
  { t: TL.scroll.end + 0.35, shot: { cx: chips.x + 400, cy: BAR + chips.y + chips.h / 2 - 20, z: 2.05 }, ease: easeOutExpo },
  { t: CUT_DEPTH, shot: { cx: chips.x + 420, cy: BAR + chips.y + chips.h / 2 - 20, z: 2.18 } },
  // Cut: the detail-depth tabs, Medium → Detailed.
  { t: CUT_DEPTH, shot: { cx: depth.x + depth.w / 2, cy: BAR + depth.y + depth.h / 2 - 18, z: 2.3 }, cut: true },
  { t: CUT_TYPING, shot: { cx: depth.x + depth.w / 2 + 20, cy: BAR + depth.y + depth.h / 2 - 18, z: 2.42 } },
  // Cut: the typing close-up, following the caret.
  { t: CUT_TYPING, shot: typing, cut: true },
  { t: TL.typing.end + 0.1, shot: typing },
  // Cut: the output-language menu.
  { t: CUT_SELECT, shot: { cx: select.x + select.w * 0.3, cy: BAR + select.y + 70, z: 2.2 }, cut: true },
  { t: C.selectPick + 0.2, shot: { cx: select.x + select.w * 0.3 + 20, cy: BAR + select.y + 66, z: 2.28 } },
  // Cut: Generate, close, through the press.
  { t: CUT_GENERATE, shot: { cx: generate.x + generate.w / 2 - 60, cy: BAR + generate.y + generate.h / 2 - 40, z: 2.5 }, cut: true },
  { t: CUT_SNAKE, shot: { cx: generate.x + generate.w / 2 - 70, cy: BAR + generate.y + generate.h / 2 - 44, z: 2.62 } },
  // Cut: the snake, drifting in slowly while it plays.
  { t: CUT_SNAKE, shot: { cx: snake.x + snake.w / 2, cy: BAR + snake.y + snake.h / 2 + 60, z: 1.75 }, cut: true },
  { t: TL.resultAt, shot: { cx: snake.x + snake.w / 2, cy: BAR + snake.y + snake.h / 2 + 50, z: 1.9 } },
  { t: TL.resultAt + 0.35, shot: result, ease: easeInOut },
  { t: CUT_ACTIONS, shot: result },
  // Cut: Copy and Download .md, close; then across to History.
  { t: CUT_ACTIONS, shot: { cx: (copy.x + download.x + download.w) / 2, cy: BAR + copy.y + 70, z: 2.25 }, cut: true },
  { t: C.download + 0.3, shot: { cx: (copy.x + download.x + download.w) / 2 + 30, cy: BAR + copy.y + 70, z: 2.32 } },
  { t: C.history - 0.05, shot: { cx: history.x + history.w / 2 - 60, cy: BAR + history.y + 70, z: 2.2 }, ease: easeInOut },
  // …and pull back as the History drawer slides in.
  { t: C.history + 0.6, shot: { cx: drawer.x + drawer.w / 2 - 120, cy: BAR + drawer.y + 330, z: 1.35 }, ease: easeInOut },
  { t: C.drawerClose + 0.2, shot: { cx: drawer.x + drawer.w / 2 - 110, cy: BAR + drawer.y + 330, z: 1.4 } },
  { t: TL.outro.start, shot: { cx: drawer.x + drawer.w / 2 - 100, cy: BAR + drawer.y + 330, z: 1.44 } },
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const resolveShot = (s: Stop['shot'], t: number) => (typeof s === 'function' ? s(t) : s);

/**
 * Keeps a zoomed shot inside the window, so a close-up never shows the stage around it;
 * when the window is smaller than the frame on an axis, that axis stays centred.
 */
const fit = (s: Shot): Shot => {
  const bound = (c: number, size: number, frame: number) => {
    if (size * s.z <= frame) return size / 2;
    const half = frame / 2 / s.z;
    return Math.max(half, Math.min(size - half, c));
  };
  return { cx: bound(s.cx, WIN.width, STAGE.width), cy: bound(s.cy, WIN.height, STAGE.height), z: s.z };
};

export const cameraAt = (t: number): Shot => {
  let i = stops.length - 1;
  while (i > 0 && stops[i].t > t) i--;
  // At a cut the later of two same-time stops wins.
  while (i + 1 < stops.length && stops[i + 1].t === stops[i].t && stops[i + 1].t <= t) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const sa = fit(resolveShot(a.shot, t));
  if (!b || b.cut) return sa;
  const k = (b.ease ?? easeInOut)(clamp01((t - a.t) / (b.t - a.t)));
  const sb = fit(resolveShot(b.shot, t));
  // Zoom interpolates in log space so pushes feel even; the centre follows linearly.
  return { cx: lerp(sa.cx, sb.cx, k), cy: lerp(sa.cy, sb.cy, k), z: Math.exp(lerp(Math.log(sa.z), Math.log(sb.z), k)) };
};

/** Time since the most recent cut (for the whip blur that sells it), or Infinity. */
export const sinceCut = (t: number) => {
  const past = CUTS.filter((c) => c <= t);
  return past.length ? t - past[past.length - 1] : Infinity;
};
