export type Lang = 'en' | 'ar';

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 600,
} as const;

// Instagram Story/Reel UI covers the top ~250px and bottom ~340px. Keep text inside.
export const SAFE = {
  top: 260,
  bottom: 360,
  side: 72,
} as const;

// Frames per scene. Scenes overlap by TRANSITION_FRAMES at each of the 5 joins,
// so the total is sum(SCENES) - 5 * TRANSITION_FRAMES = 650 - 50 = 600.
export const TRANSITION_FRAMES = 10;
export const SCENES = {
  hook: 70,
  type: 135,
  language: 90,
  generate: 105,
  result: 140,
  outro: 110,
} as const;

// Colors taken from the live site (src/index.css, SnakeGame.tsx, promptz-icon.svg).
export const C = {
  bg: '#FAFAFC',
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255,255,255,0.80)',
  border: 'rgba(228,228,231,0.9)',
  borderStrong: '#E4E4E7',
  ink: '#18181B',
  inkSoft: '#3F3F46',
  muted: '#71717A',
  faint: '#A1A1AA',
  purple: '#7C3AED',
  purpleDeep: '#6D28D9',
  purpleBrand: '#7132F5',
  purpleSoft: '#EDE9FE',
  purpleTint: 'rgba(124,58,237,0.10)',
  lilac: '#D3B8FE',
  snakeBg: '#FAF8FF',
  snakeFood: 'rgba(124, 58, 237, 0.18)',
  emerald: '#059669',
  logoInk: '#1E1928',
} as const;

export const RADIUS = {
  card: 44,
  panel: 32,
  chip: 999,
  button: 22,
} as const;

export const SHADOW = {
  card: '0 30px 80px -20px rgba(76, 29, 149, 0.25), 0 8px 24px -8px rgba(24, 24, 27, 0.10)',
  soft: '0 10px 30px -10px rgba(24, 24, 27, 0.15)',
  glow: '0 20px 60px -10px rgba(124, 58, 237, 0.55)',
} as const;
