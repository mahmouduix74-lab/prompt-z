import { interpolate, spring, Easing } from 'remotion';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Splits into user-perceived characters so Arabic marks and emoji are never cut in half. */
export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), (s) => s.segment);

/** Typewriter: the visible slice of `text` at `frame`, starting at `start`, at `perFrame` graphemes per frame. */
export const typed = (text: string, frame: number, start: number, perFrame = 1): string => {
  const g = graphemes(text);
  const count = Math.max(0, Math.min(g.length, Math.floor((frame - start) * perFrame)));
  return g.slice(0, count).join('');
};

/** Frame at which typing of `text` finishes. */
export const typedEnd = (text: string, start: number, perFrame = 1): number =>
  start + Math.ceil(graphemes(text).length / perFrame);

/** 0 → 1 spring, starting at `delay` frames. */
export const pop = (frame: number, fps: number, delay = 0, damping = 14, mass = 0.7): number =>
  spring({ frame: frame - delay, fps, config: { damping, mass, stiffness: 140 } });

/** Smooth 0 → 1 over [start, start + duration] with an ease-out curve. */
export const ease = (frame: number, start: number, duration: number): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

/** Caret blink: visible for 16 of every 30 frames. */
export const caretOn = (frame: number): boolean => frame % 30 < 16;
