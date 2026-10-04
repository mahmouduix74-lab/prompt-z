import React from 'react';

/**
 * "PROMPTZ" in square pixels with two outlined echoes behind it, after the pixel wordmarks of
 * prompt sites. Drawn as SVG so it needs no font and stays sharp at any size. Each glyph is a grid
 * of rows; "#" is a filled cell.
 */
const GLYPHS: Record<string, string[]> = {
  P: ['######.', '#######', '##...##', '##...##', '#######', '######.', '##.....', '##.....', '##.....'],
  R: ['######.', '#######', '##...##', '##...##', '######.', '######.', '##..##.', '##...##', '##...##'],
  O: ['#######', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '#######'],
  M: ['##.....##', '###...###', '####.####', '##.###.##', '##..#..##', '##.....##', '##.....##', '##.....##', '##.....##'],
  T: ['########', '########', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...'],
  Z: ['#######', '#######', '....###', '...###.', '..###..', '.###...', '###....', '#######', '#######'],
};

const WORD = 'PROMPTZ';
const ROWS = 9;
const GAP = 1;
/** Echo offsets in cells, farthest first. */
const ECHOES = [1.1, 0.55];

/** One path covering every filled cell of the word. */
function buildPath(): { d: string; width: number } {
  let x = 0;
  const parts: string[] = [];
  for (const letter of WORD) {
    const rows = GLYPHS[letter];
    rows.forEach((row, y) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') parts.push(`M${x + c} ${y}h1v1h-1z`);
    });
    x += rows[0].length + GAP;
  }
  return { d: parts.join(''), width: x - GAP };
}

const { d: PATH, width: WIDTH } = buildPath();
const PAD = Math.max(...ECHOES) + 0.3;

export const PixelWordmark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox={`-0.2 -0.2 ${WIDTH + PAD} ${ROWS + PAD}`}
    role="img"
    aria-label="PromptZ"
    className={className}
    shapeRendering="crispEdges"
  >
    {ECHOES.map((offset) => (
      <g key={offset} transform={`translate(${offset} ${offset})`}>
        {/* The grey stroke around the cells, then the page colour over the cells, leaves an outline. */}
        <path d={PATH} className="fill-zinc-400 stroke-zinc-400 dark:fill-zinc-600 dark:stroke-zinc-600" strokeWidth={0.32} strokeLinejoin="miter" />
        <path d={PATH} className="fill-[#fafafa] dark:fill-[#09090b]" />
      </g>
    ))}
    <path d={PATH} className="fill-zinc-950 dark:fill-white" />
  </svg>
);
