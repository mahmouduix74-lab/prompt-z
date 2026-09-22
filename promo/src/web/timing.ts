import TL from './timeline.json';
import META from '../../public/capture/meta-light.json';
import VO_DUR from '../../public/vo/durations.json';

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

/** Cursor position (viewport px) the capture used at video time t, or null before it appears. */
export const mouseAt = (t: number): [number, number] | null => {
  const i = Math.max(0, Math.min(META.frames.length - 1, Math.round(t * FPS)));
  const m = META.frames[i].mouse;
  return m ? [m[0], m[1]] : null;
};

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
