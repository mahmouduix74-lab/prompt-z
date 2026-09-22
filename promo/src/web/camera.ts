import { BAR, STAGE, TL, WIN, clamp01, easeInOut, rect } from './timing';

/** A camera stop: the window-space point placed at the frame centre, and the zoom. */
type Shot = { cx: number; cy: number; z: number };
type Stop = { t: number; shot: Shot };

const C = TL.clicks;
const wide: Shot = { cx: WIN.width / 2, cy: WIN.height / 2, z: 1 };

// Viewport rects (captured after the page scrolled to the console) → window space (+BAR).
const hero = rect('heroTitle');
const input = rect('inputPanel');
const output = rect('outputPanel');
const domain = rect('domain');
const select = rect('select');
const generate = rect('generate');

const shots = {
  hero: { cx: hero.x + hero.w / 2, cy: BAR + hero.y + hero.h / 2 + 34, z: 1.5 },
  console: { cx: input.x + input.w / 2, cy: BAR + (domain.y + input.y + 200) / 2, z: 1.36 },
  typing: { cx: input.x + input.w * 0.62, cy: BAR + input.y + 150, z: 1.62 },
  select: { cx: select.x + select.w * 0.4, cy: BAR + select.y + 70, z: 1.62 },
  generate: { cx: generate.x + generate.w / 2 - 170, cy: BAR + generate.y - 90, z: 1.58 },
  snake: { cx: output.x + output.w / 2, cy: BAR + output.y + output.h / 2, z: 1.42 },
  result: { cx: output.x + output.w / 2, cy: BAR + output.y + output.h / 2, z: 1.36 },
} satisfies Record<string, Shot>;

const stops: Stop[] = [
  { t: 0, shot: wide },
  { t: 1.0, shot: wide },
  { t: 5.3, shot: shots.hero },
  { t: 6.25, shot: wide },
  { t: TL.scroll.end - 0.05, shot: wide },
  { t: C.domain - 0.15, shot: shots.console },
  { t: C.textarea + 0.05, shot: shots.console },
  { t: TL.typing.start + 0.35, shot: shots.typing },
  { t: TL.typing.end + 0.1, shot: shots.typing },
  { t: C.select - 0.05, shot: shots.select },
  { t: C.selectPick + 0.2, shot: shots.select },
  { t: C.generate - 0.1, shot: shots.generate },
  { t: C.generate + 0.2, shot: shots.generate },
  { t: C.generate + 0.8, shot: shots.snake },
  { t: TL.resultAt, shot: shots.snake },
  { t: TL.resultAt + 0.6, shot: shots.result },
  { t: TL.theme[2].at - 0.75, shot: shots.result },
  { t: TL.theme[2].at - 0.1, shot: wide },
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

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
  const a = stops[i];
  const b = stops[i + 1];
  if (!b) return fit(a.shot);
  const k = easeInOut(clamp01((t - a.t) / (b.t - a.t)));
  // Zoom interpolates in log space so pushes feel even; the centre follows linearly.
  const z = Math.exp(lerp(Math.log(a.shot.z), Math.log(b.shot.z), k));
  return fit({ cx: lerp(a.shot.cx, b.shot.cx, k), cy: lerp(a.shot.cy, b.shot.cy, k), z });
};
