import React from 'react';

/**
 * "promptZ" as a dot-matrix sign: round dots, lit for the letters and faint for the rest of each
 * letter's grid, echoing the dotted background. Lower-case letters sit on the x-height with the
 * "p" descenders below it; the capital Z (and the "t") rise to the cap height. Drawn as SVG, so it
 * needs no font. In each glyph "#" is a lit dot; every glyph has ROWS rows.
 */
const GLYPHS: Record<string, string[]> = {
  p: ['.....', '.....', '#.##.', '##..#', '#...#', '##..#', '#.##.', '#....', '#....'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '.....', '.....'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....', '.....'],
  m: ['.......', '.......', '###.##.', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '.......', '.......'],
  t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##', '....', '....'],
  Z: ['######', '.....#', '....#.', '...#..', '..#...', '.#....', '######', '......', '......'],
};

const WORD = 'promptZ';
const ROWS = 9;
const GAP = 1;
const RADIUS = 0.42;
/** Unlit dots are smaller and faint, so they read as the sign's grid, not as letters. */
const UNLIT_RADIUS = 0.3;

const { lit, unlit, width } = (() => {
  const on: [number, number][] = [];
  const off: [number, number][] = [];
  let x = 0;
  for (const letter of WORD) {
    const rows = GLYPHS[letter];
    rows.forEach((row, y) => {
      for (let c = 0; c < row.length; c++) (row[c] === '#' ? on : off).push([x + c + 0.5, y + 0.5]);
    });
    x += rows[0].length + GAP;
  }
  return { lit: on, unlit: off, width: x - GAP };
})();

/** One path of circles, so each layer is a single element. */
const dots = (points: [number, number][], r: number) =>
  points
    .map(([cx, cy]) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`)
    .join('');

const LIT = dots(lit, RADIUS);
const UNLIT = dots(unlit, UNLIT_RADIUS);

export const PixelWordmark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox={`0 0 ${width} ${ROWS}`} role="img" aria-label="promptZ" className={className}>
    <path d={UNLIT} className="fill-zinc-900/[0.045] dark:fill-white/[0.06]" />
    <path d={LIT} className="fill-zinc-950 dark:fill-white" />
  </svg>
);
