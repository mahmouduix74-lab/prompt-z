import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, RADIUS, SAFE, SHADOW, Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY } from '../copy';
import { pop } from '../anim';
import { Caption } from '../components/Caption';
import { PrimaryButton, WandIcon, Tap } from '../components/Ui';

/*
 * Scene 3 "Generate" (110 frames): the Generate button is tapped, flips to its loading
 * state, then glides up into a status chip while the output panel's waiting overlay
 * (the site's snake game, SnakeGame.tsx) rises underneath and plays a scripted round.
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ---------- Timeline (local frames) ----------
const PRESS = 16; // the tap bottoms out and the button switches to "Generating..."
const TAP_START = PRESS - 8; // Tap's ring lands at t = 0.4 of its 20-frame run
const MOVE = 25; // button glides up into a status chip
const CARD_IN = 29; // output panel rises
const SNAKE_START = 40; // first snake step
const STEP = 3; // frames per snake step (site ticks every 145 ms ≈ 4.4 frames; a touch livelier here)

// ---------- Layout ----------
const CX = 540;
const BTN_Y = 930; // button centre while it is the hero
const CHIP_Y = 456; // button centre once it has become the status chip
const CHIP_SCALE = 0.56; // 54px label → ~30px in the chip
const BTN_WIDTH = 780;
const CARD_TOP = 530;
const CELL_PX = 41;
const BOARD_PX = CELL_PX * 16; // 656

// ---------- Snake game geometry (same canvas units as the site: 16 cells x 14) ----------
const GRID = 16;
const UNIT = 14;
const BOARD = GRID * UNIT; // 224

type Cell = readonly [number, number];

// Head positions, one per step. The first two entries are the initial body behind the head,
// so the snake starts exactly like the site's: head (8,8), body (7,8), (6,8), heading right.
const HIST: Cell[] = [
  [6, 8],
  [7, 8],
  [8, 8], // step 0
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8], // step 4: eats food 1 (the site's initial food cell)
  [12, 7],
  [12, 6],
  [12, 5],
  [11, 5],
  [10, 5], // step 9: eats food 2
  [9, 5],
  [8, 5],
  [7, 5],
  [7, 6],
  [7, 7],
  [7, 8], // step 15: eats food 3
  [7, 9],
  [7, 10],
  [7, 11],
  [8, 11],
  [9, 11],
  [10, 11],
  [11, 11],
  [12, 11],
  [12, 12],
  [12, 13], // step 25: would eat food 4 (after the scene ends)
  [12, 14],
  [12, 15],
];
const HIST_OFFSET = 2;
const MAX_STEP = HIST.length - 1 - HIST_OFFSET;

// `plus` places the floating "+1" (in cells, from the food's centre) on the side the snake is not heading to.
const FOODS: { cell: Cell; eatStep: number; plus: Cell }[] = [
  { cell: [12, 8], eatStep: 4, plus: [1.9, 0.3] },
  { cell: [10, 5], eatStep: 9, plus: [0.2, -1.5] },
  { cell: [7, 8], eatStep: 15, plus: [-1.9, 0.3] },
  { cell: [12, 13], eatStep: 25, plus: [1.9, 0] },
];

const eatenBy = (step: number) => FOODS.filter((f) => f.eatStep <= step).length;
const lengthAt = (step: number) => 3 + eatenBy(step);
const segAt = (step: number, i: number): Cell | undefined => HIST[step + HIST_OFFSET - i];
const eatFrame = (eatStep: number) => SNAKE_START + eatStep * STEP;

// The site's own score labels (SnakeGame.tsx), not new copy.
const SCORE_LABEL = { en: { score: 'Score:', best: 'Best:' }, ar: { score: 'النقاط:', best: 'الأعلى:' } } as const;
const BEST = 12;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// The site paints body segments as rgba(124,58,237,a) over #FAF8FF. Pre-blend them into solid colours so
// segments passing a corner mid-glide do not show darker overlap patches.
const bodyColor = (a: number) => {
  const mix = (fg: number, bg: number) => Math.round(bg + (fg - bg) * a);
  return `rgb(${mix(124, 250)}, ${mix(58, 248)}, ${mix(237, 255)})`;
};

// ---------- Icons (paths copied from lucide-react as used by the site) ----------
const Icon: React.FC<{ size: number; color: string; stroke?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  size,
  color,
  stroke = 2,
  children,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {children}
  </svg>
);

const LoaderIcon: React.FC<{ size: number; color: string; rotate: number }> = ({ size, color, rotate }) => (
  <Icon size={size} color={color} stroke={2.4} style={{ transform: `rotate(${rotate}deg)` }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Icon>
);

const GamepadIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Icon size={size} color={color}>
    <line x1="6" x2="10" y1="11" y2="11" />
    <line x1="8" x2="8" y1="9" y2="13" />
    <line x1="15" x2="15.01" y1="12" y2="12" />
    <line x1="18" x2="18.01" y1="10" y2="10" />
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
  </Icon>
);

const SparklesIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Icon size={size} color={color}>
    <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
    <path d="M20 2v4" />
    <path d="M22 4h-4" />
    <circle cx="4" cy="20" r="2" />
  </Icon>
);

const TrophyIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Icon size={size} color={color}>
    <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" />
    <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" />
    <path d="M18 9h1.5a1 1 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
    <path d="M6 9H4.5a1 1 0 0 1 0-5H6" />
  </Icon>
);

const TerminalIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Icon size={size} color={color} stroke={2.4}>
    <path d="M12 19h8" />
    <path d="m4 17 6-6-6-6" />
  </Icon>
);

const CopyIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Icon size={size} color={color}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
);

/** Four-point sparkle used for the press burst. */
const Spark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
  </svg>
);

// ---------- Snake board ----------
const SnakeBoard: React.FC<{ frame: number; fps: number; appear: number }> = ({ frame, fps, appear }) => {
  const stepFloat = Math.min(MAX_STEP - 1, Math.max(0, (frame - SNAKE_START) / STEP));
  const k = Math.floor(stepFloat);
  const frac = frame < SNAKE_START ? 0 : stepFloat - k;

  const len = lengthAt(k + 1);
  const segments: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    const to = segAt(k + 1, i) ?? segAt(k, i)!;
    const from = segAt(k, i) ?? to;
    segments.push({ x: lerp(from[0], to[0], frac) * UNIT, y: lerp(from[1], to[1], frac) * UNIT });
  }

  const headFrom = segAt(k, 0)!;
  const headTo = segAt(k + 1, 0)!;
  const dir = frame < SNAKE_START ? { x: 1, y: 0 } : { x: headTo[0] - headFrom[0], y: headTo[1] - headFrom[1] };

  const hx = segments[0].x;
  const hy = segments[0].y;
  let eyes: [number, number, number, number];
  if (dir.x === 1) eyes = [hx + UNIT - 3.5, hy + 4, hx + UNIT - 3.5, hy + UNIT - 4];
  else if (dir.x === -1) eyes = [hx + 3.5, hy + 4, hx + 3.5, hy + UNIT - 4];
  else if (dir.y === -1) eyes = [hx + 4, hy + 3.5, hx + UNIT - 4, hy + 3.5];
  else eyes = [hx + 4, hy + UNIT - 3.5, hx + UNIT - 4, hy + UNIT - 3.5];

  // Food: each item is on the board from the step its predecessor is eaten until its own eat step.
  const foods = FOODS.map((f, j) => {
    const spawnFrame = j === 0 ? appear : eatFrame(FOODS[j - 1].eatStep) + 1;
    const visible = frame >= spawnFrame && frame < eatFrame(f.eatStep);
    const s = spring({ frame: frame - spawnFrame, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
    return { ...f, visible, s };
  });

  const lines: string[] = [];
  for (let i = 0; i <= GRID; i++) {
    lines.push(`M${i * UNIT} 0V${BOARD}`, `M0 ${i * UNIT}H${BOARD}`);
  }

  const pulse = 1 + 0.14 * Math.sin(frame * 0.32);

  return (
    <svg width={BOARD_PX} height={BOARD_PX} viewBox={`0 0 ${BOARD} ${BOARD}`} style={{ display: 'block' }}>
      <defs>
        <filter id="gen-head-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.6" floodColor={C.purpleDeep} floodOpacity="0.85" />
        </filter>
        <filter id="gen-food-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor={C.purple} floodOpacity="0.95" />
        </filter>
      </defs>
      <rect width={BOARD} height={BOARD} fill={C.snakeBg} />
      <path d={lines.join('')} stroke="rgba(147, 51, 234, 0.12)" strokeWidth={0.6} fill="none" />

      {foods.map((f, j) => {
        if (!f.visible) return null;
        const cx = f.cell[0] * UNIT + UNIT / 2;
        const cy = f.cell[1] * UNIT + UNIT / 2;
        return (
          <g key={j} transform={`translate(${cx} ${cy}) scale(${f.s})`}>
            <circle r={(UNIT / 1.6) * pulse} fill={C.snakeFood} />
            <circle r={UNIT / 2.6} fill={C.purple} filter="url(#gen-food-glow)" />
          </g>
        );
      })}

      {/* Eat bursts: a ring expanding out of the eaten food cell. */}
      {FOODS.map((f, j) => {
        const t = (frame - eatFrame(f.eatStep)) / 14;
        if (t < 0 || t > 1) return null;
        const e = Easing.out(Easing.cubic)(t);
        return (
          <circle
            key={`burst-${j}`}
            cx={f.cell[0] * UNIT + UNIT / 2}
            cy={f.cell[1] * UNIT + UNIT / 2}
            r={6 + e * 16}
            fill="none"
            stroke={C.purple}
            strokeWidth={2.2 * (1 - t) + 0.3}
            opacity={1 - t}
          />
        );
      })}

      {segments
        .map((s, i) => ({ ...s, i }))
        .reverse()
        .map(({ x, y, i }) => {
          const isHead = i === 0;
          const opacity = Math.max(0.35, 1 - i / (len + 3));
          return (
            <rect
              key={i}
              x={x + 1}
              y={y + 1}
              width={UNIT - 2}
              height={UNIT - 2}
              rx={isHead ? 5 : 3}
              fill={isHead ? C.purpleDeep : bodyColor(opacity)}
              filter={isHead ? 'url(#gen-head-glow)' : undefined}
            />
          );
        })}
      <circle cx={eyes[0]} cy={eyes[1]} r={1.4} fill="#FFFFFF" />
      <circle cx={eyes[2]} cy={eyes[3]} r={1.4} fill="#FFFFFF" />
    </svg>
  );
};

// ---------- Scene ----------
export const Generate: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = COPY[lang];
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // --- Button: entrance, press, state flip, glide into the chip ---
  const btnIn = pop(frame, fps, 0, 15, 0.6);
  const pressDown = interpolate(frame, [PRESS - 5, PRESS], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const release = spring({ frame: frame - PRESS, fps, config: { damping: 8, stiffness: 240, mass: 0.55 } });
  const pressScale = frame < PRESS ? 1 - 0.08 * pressDown : 0.92 + 0.08 * release;
  const generating = frame >= PRESS;

  const mv = pop(frame, fps, MOVE, 16, 0.7);
  const btnY = lerp(BTN_Y, CHIP_Y, mv);
  const btnScale = interpolate(btnIn, [0, 1], [0.9, 1]) * pressScale * lerp(1, CHIP_SCALE, mv);

  const spinnerIn = spring({ frame: frame - PRESS, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } });
  const shimmerX = (((frame - PRESS) * 26) % 1300) - 350;

  // Halo behind the hero button: breathes before the tap, flares on it, fades as the button leaves.
  const breathe = 0.55 + 0.2 * Math.sin(frame * 0.28);
  const flare = interpolate(frame, [PRESS - 2, PRESS + 3, PRESS + 18], [0, 1, 0], clamp);
  const haloOpacity = (breathe + flare * 0.6) * (1 - mv) * btnIn;
  const haloScale = 1 + flare * 0.25;

  // --- Output panel ---
  const cardIn = pop(frame, fps, CARD_IN, 15, 0.8);
  // Contents trail the card by a few frames each, so the panel assembles as it lands.
  const headerIn = pop(frame, fps, CARD_IN + 1, 16, 0.6);
  const pillIn = pop(frame, fps, CARD_IN + 2, 12, 0.5);
  const scoreIn = pop(frame, fps, CARD_IN + 3, 14, 0.6);
  const boardIn = pop(frame, fps, CARD_IN + 4, 15, 0.7);

  const stepNow = frame < SNAKE_START ? -1 : Math.floor((frame - SNAKE_START) / STEP);
  const score = stepNow < 0 ? 0 : eatenBy(stepNow);
  const lastEat = [...FOODS].reverse().find((f) => eatFrame(f.eatStep) <= frame);
  const bumpS = lastEat ? spring({ frame: frame - eatFrame(lastEat.eatStep), fps, config: { damping: 8, stiffness: 220, mass: 0.5 } }) : 1;
  const scoreScale = lastEat ? 1.55 - 0.55 * bumpS : 1;

  const accent = '#DDD6FE'; // violet-200: pill + score bar borders
  const reveal = (p: number, dy = 26): React.CSSProperties => ({
    opacity: p,
    transform: `translateY(${(1 - p) * dy}px) scale(${0.96 + 0.04 * p})`,
  });

  return (
    <AbsoluteFill dir={dir} style={{ backgroundColor: 'transparent' }}>
      <Caption text={copy.captions.generate} lang={lang} highlight={isAr ? ['توليد'] : ['Generate']} />

      {/* ---------- Output panel with the waiting snake game ---------- */}
      <div
        dir={dir}
        style={{
          position: 'absolute',
          top: CARD_TOP,
          left: SAFE.side,
          right: SAFE.side,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 170}px) scale(${0.9 + 0.1 * cardIn})`,
          transformOrigin: '50% 0%',
          backgroundColor: C.surfaceSoft,
          border: `2px solid ${C.border}`,
          borderRadius: RADIUS.card,
          boxShadow: SHADOW.card,
          backdropFilter: 'blur(24px)',
          overflow: 'hidden',
          fontFamily: FONTS.body(lang),
          color: C.ink,
        }}
      >
        {/* Header: Terminal icon + "Structured Prompt", Copy disabled while loading */}
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 36px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderBottom: '2px solid rgba(228,228,231,0.6)',
            opacity: headerIn,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <TerminalIcon size={38} color={C.purple} />
            <span style={{ fontSize: 32, fontWeight: 600, color: C.ink }}>{copy.ui.outputLabel}</span>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: C.purple,
                opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * 0.3)),
                marginInlineStart: 4,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 16,
              fontSize: 28,
              fontWeight: 600,
              color: C.faint,
              backgroundColor: 'rgba(244,244,245,0.6)',
              border: '2px solid rgba(228,228,231,0.6)',
              opacity: 0.75,
            }}
          >
            <CopyIcon size={28} color={C.faint} />
            <span>{copy.ui.copy}</span>
          </div>
        </div>

        {/* Loading overlay body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            padding: '30px 40px 38px',
            backgroundColor: 'rgba(255,255,255,0.55)',
          }}
        >
          <div
            style={{
              ...reveal(pillIn, 30),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 28px',
              borderRadius: RADIUS.chip,
              backgroundColor: C.purpleSoft,
              border: `2px solid ${accent}`,
              color: C.purpleDeep,
              fontSize: 32,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <GamepadIcon size={36} color={C.purple} />
            <span>{copy.captions.snake}</span>
          </div>

          <div
            style={{
              ...reveal(scoreIn, 40),
              width: BOARD_PX,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 26px',
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.92)',
              border: `2px solid ${accent}`,
              boxShadow: '0 2px 6px rgba(24,24,27,0.05)',
              fontSize: 30,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.purple, fontWeight: 700 }}>
              <SparklesIcon size={30} color={C.purple} />
              <span style={{ fontFamily: isAr ? FONTS.body('ar') : FONTS.mono }}>{SCORE_LABEL[lang].score}</span>
              <span
                style={{
                  display: 'inline-block',
                  minWidth: 24,
                  fontFamily: FONTS.mono,
                  transform: `scale(${scoreScale})`,
                  color: scoreScale > 1.05 ? C.purpleDeep : C.purple,
                }}
              >
                {score}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.muted, fontWeight: 600 }}>
              <TrophyIcon size={30} color="#F59E0B" />
              <span style={{ fontFamily: isAr ? FONTS.body('ar') : FONTS.mono }}>{SCORE_LABEL[lang].best}</span>
              <span style={{ fontFamily: FONTS.mono }}>{BEST}</span>
            </div>
          </div>

          <div style={{ position: 'relative', ...reveal(boardIn, 60) }}>
            <div
              dir="ltr"
              style={{
                borderRadius: 30,
                overflow: 'hidden',
                border: `4px solid ${C.lilac}`,
                boxShadow: '0 12px 30px -12px rgba(124,58,237,0.35)',
              }}
            >
              <SnakeBoard frame={frame} fps={fps} appear={CARD_IN + 10} />
            </div>
            {/* "+1" floats out of each eaten food */}
            {FOODS.map((f, j) => {
              const t = (frame - eatFrame(f.eatStep)) / 18;
              if (t < 0 || t > 1) return null;
              const rise = Easing.out(Easing.cubic)(t);
              return (
                <div
                  key={j}
                  dir="ltr"
                  style={{
                    position: 'absolute',
                    left: 4 + (f.cell[0] + 0.5 + f.plus[0]) * CELL_PX,
                    top: 4 + (f.cell[1] + 0.5 + f.plus[1]) * CELL_PX - rise * 44,
                    transform: `translate(-50%, -50%) scale(${0.8 + 0.3 * Math.min(1, t * 4)})`,
                    opacity: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4,
                    fontFamily: FONTS.mono,
                    fontWeight: 700,
                    fontSize: 36,
                    color: C.purpleDeep,
                    textShadow: '0 2px 10px rgba(255,255,255,0.9)',
                  }}
                >
                  +1
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Generate button → status chip ---------- */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: btnY,
          width: 0,
          height: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -420,
            top: -170,
            width: 840,
            height: 340,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(124,58,237,0.55), rgba(124,58,237,0))',
            filter: 'blur(30px)',
            opacity: haloOpacity,
            transform: `scale(${haloScale})`,
          }}
        />
        <div
          dir={dir}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(-50%, -50%) scale(${btnScale})`,
            opacity: btnIn,
          }}
        >
          <PrimaryButton
            lang={lang}
            fontSize={54}
            label={generating ? copy.ui.generating : copy.ui.generate}
            style={{ width: BTN_WIDTH, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}
            icon={
              generating ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: -40,
                      bottom: -40,
                      left: shimmerX,
                      width: 160,
                      transform: 'skewX(-20deg)',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.28), rgba(255,255,255,0))',
                    }}
                  />
                  <div style={{ transform: `scale(${spinnerIn})`, display: 'flex' }}>
                    <LoaderIcon size={58} color="#FFFFFF" rotate={frame * 12} />
                  </div>
                </>
              ) : (
                <WandIcon size={58} />
              )
            }
          />
        </div>

        {/* Press burst: sparks fly out of the button when it is tapped */}
        {Array.from({ length: 10 }, (_, i) => {
          const t = (frame - PRESS) / 20;
          const fadeWithMove = Math.max(0, 1 - mv * 2.5);
          if (t < 0 || t > 1 || fadeWithMove <= 0) return null;
          const angle = (i / 10) * Math.PI * 2 + 0.3;
          const e = Easing.out(Easing.cubic)(t);
          const rx = 380 + (i % 3) * 30;
          const ry = 130 + (i % 2) * 40;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: Math.cos(angle) * rx * (0.55 + 0.45 * e) - 12,
                top: Math.sin(angle) * ry * (0.55 + 0.45 * e) - 12,
                opacity: (1 - t) * Math.min(1, t * 6) * fadeWithMove,
                transform: `scale(${(i % 2 ? 0.8 : 1.2) * (1 - 0.4 * t)}) rotate(${t * 90}deg)`,
              }}
            >
              <Spark size={24} color={i % 3 === 0 ? C.lilac : C.purple} />
            </div>
          );
        })}
      </div>

      <Tap x={CX + (isAr ? -110 : 110)} y={BTN_Y + 18} t={(frame - TAP_START) / 20} />
    </AbsoluteFill>
  );
};
