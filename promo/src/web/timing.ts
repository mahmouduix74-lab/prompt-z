import TL from './timeline.json';
import META from '../../public/capture/meta-light.json';
import VO_DUR from '../../public/vo/durations.json';
import MACRO_TOGGLE_LIGHT from '../../public/capture/macro/toggle-light.json';
import MACRO_TOGGLE_DARK from '../../public/capture/macro/toggle-dark.json';
import MACRO_DOMAIN_DARK from '../../public/capture/macro/domain-dark.json';
import MACRO_DEPTH_DARK from '../../public/capture/macro/depth-dark.json';
import MACRO_TYPING_DARK from '../../public/capture/macro/typing-dark.json';
import MACRO_GENERATE_DARK from '../../public/capture/macro/generate-dark.json';

export { TL, META };

export const FPS = TL.fps;
export const DURATION_FRAMES = Math.round(TL.duration * FPS);
export const STAGE = { width: 1920, height: 1080 } as const;

// Browser window: the captured 1440×900 viewport under a slim title bar.
export const VIEW = TL.viewport;
export const BAR = 38;
export const WIN = { width: VIEW.width, height: VIEW.height + BAR } as const;

// Last frame the capture holds; later frames reuse it (the outro covers them).
export const LAST_CAPTURED = META.frames.length - 1;

export type Theme = 'light' | 'dark';
export type Rect = { x: number; y: number; w: number; h: number };

export const rect = (name: keyof typeof META.rects): Rect => META.rects[name] as Rect;

export const VO = TL.vo.map((l) => ({ ...l, dur: (VO_DUR as Record<string, number>)[l.id] }));

/** Theme reveals: the new theme grows as a circle out of the header toggle. */
export const REVEALS = TL.theme.slice(1).map((s) => ({ at: s.at, to: s.to as Theme, from: (s.to === 'dark' ? 'light' : 'dark') as Theme }));

/** 4× close-up passes: a region of the page re-shot sharper for the macro shots. */
export type Macro = { id: string; theme: Theme; from: number; to: number; rect: Rect };
export const MACROS: Macro[] = [
  { ...MACRO_TOGGLE_LIGHT, theme: 'light' },
  { ...MACRO_TOGGLE_DARK, theme: 'dark' },
  { ...MACRO_DOMAIN_DARK, theme: 'dark' },
  { ...MACRO_DEPTH_DARK, theme: 'dark' },
  { ...MACRO_TYPING_DARK, theme: 'dark' },
  { ...MACRO_GENERATE_DARK, theme: 'dark' },
].map((m) => ({ id: m.id, theme: m.theme as Theme, from: m.from, to: m.to, rect: m.rect }));

const frameAt = (t: number) => META.frames[Math.max(0, Math.min(META.frames.length - 1, Math.round(t * FPS)))];

/** Cursor position (viewport px) the capture used at video time t, or null before it appears. */
export const mouseAt = (t: number): [number, number] | null => {
  const m = frameAt(t).mouse;
  return m ? [m[0], m[1]] : null;
};

/** End of the typed text (the caret), viewport px, or null before anything is typed. */
export const caretAt = (t: number): [number, number] | null => {
  const c = (frameAt(t) as { caret?: number[] | null }).caret;
  return c ? [c[0], c[1]] : null;
};

/** Bottom edge of the streamed result text (viewport px), once the result is showing. */
export const outBottomAt = (t: number): number | null => (frameAt(t) as { outBottom?: number | null }).outBottom ?? null;

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
