import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile } from 'remotion';
import { LogoIcon } from './Logo';
import { CLASH, INTER, MONTSERRAT } from './fonts';
import { FPS, TL, clamp01, easeInOut, easeOut } from './timing';

const START = TL.outro.start;
export const OUTRO_CLICK = TL.outro.click;

/** The site's rotating two-disc orb (xtract-hero.css → .xhero-orb), light theme. */
const Orb: React.FC<{ t: number; size: number }> = ({ t, size }) => {
  const inner = size * (320 / 480);
  const disc = (s: number, bg: string, deg: number): React.CSSProperties => ({
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: s,
    height: s,
    marginLeft: -s / 2,
    marginTop: -s / 2,
    borderRadius: '50%',
    background: bg,
    transform: `rotate(${deg}deg)`,
  });
  return (
    <div style={{ position: 'absolute', left: '50%', top: '45%', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, filter: 'blur(26px)', opacity: 0.62 }}>
      <div style={disc(size, 'linear-gradient(229deg, #c084fc 13%, rgba(192,132,252,0) 35.02%, rgba(168,85,247,0) 64.17%, #7c3aed 88%)', (-360 * t) / 10)} />
      <div style={disc(inner, 'linear-gradient(141deg, #d8b4fe 13%, rgba(216,180,254,0) 35.02%, rgba(147,51,234,0) 64.17%, #9333ea 88%)', (360 * t) / 12)} />
    </div>
  );
};

const rise = (t: number, at: number, dist = 40) => {
  const p = easeOut(clamp01((t - at) / 0.7));
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * dist}px)`,
    filter: `blur(${(1 - clamp01(p * 1.4)) * 10}px)`,
  } as React.CSSProperties;
};

// ---- The four site characters, around the lockup ------------------------------------------

const CHAR = 250;
type Spot = { file: string; x: number; y: number; at: number; phase: number };
// Reading order: top-left, top-right, bottom-left, bottom-right. The right-hand pair is flipped
// so all four face the lockup, as the site's <Character flip /> does.
const SPOTS: Spot[] = [
  { file: 'create-character.svg', x: 250, y: 120, at: START + 0.35, phase: 0 },
  { file: 'explore-character.svg', x: 1920 - 250 - CHAR, y: 110, at: START + 0.5, phase: 1.6 },
  { file: 'customize-character.svg', x: 300, y: 650, at: START + 0.65, phase: 3.1 },
  { file: 'organize-character.svg', x: 1920 - 300 - CHAR, y: 660, at: START + 0.8, phase: 4.5 },
];

const Character: React.FC<{ spot: Spot; t: number }> = ({ spot, t }) => {
  const facesLeft = spot.x > 960;
  const p = spring({ frame: Math.round((t - spot.at) * FPS), fps: FPS, config: { damping: 11, mass: 0.8, stiffness: 140 } });
  const w = (t * Math.PI * 2) / 3 + spot.phase;
  const float = Math.sin(w) * 9;
  const sway = Math.sin(w * 0.7 + 1) * 2.4;
  const enterTilt = (1 - p) * (facesLeft ? 26 : -26);
  // After settling, each one turns towards the button once, around the click.
  const look = Math.sin(clamp01((t - OUTRO_CLICK + 0.35) / 0.7) * Math.PI) * (facesLeft ? -5 : 5);
  return (
    <div style={{ position: 'absolute', left: spot.x, top: spot.y, width: CHAR, height: CHAR }}>
      <div
        style={{
          position: 'absolute',
          inset: -18,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 70%)',
          opacity: p,
          transform: `translateY(${float * 0.5}px) scale(${0.4 + 0.6 * p})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: Math.min(1, p * 2),
          transform: `translateY(${(1 - p) * 110 + float}px) scale(${0.3 + 0.7 * p}) rotate(${enterTilt + sway + look}deg)`,
          transformOrigin: '50% 85%',
        }}
      >
        <Img src={staticFile(spot.file)} style={{ width: CHAR, height: CHAR, transform: facesLeft ? 'scaleX(-1)' : undefined }} />
      </div>
    </div>
  );
};

const Sparkle: React.FC<{ x: number; y: number; size: number; at: number; t: number; color: string }> = ({ x, y, size, at, t, color }) => {
  const p = easeOut(clamp01((t - at) / 0.4));
  const twinkle = 0.75 + 0.25 * Math.sin((t - at) * 6);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, opacity: p * twinkle, transform: `scale(${p}) rotate(${(t - at) * 40}deg)` }}
    >
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
    </svg>
  );
};

export const Outro: React.FC<{ t: number }> = ({ t }) => {
  if (t < START) return null;
  const orbIn = easeInOut(clamp01((t - START - 0.05) / 0.9));

  // The site's cursor (purple dot → ring over the button) glides in and presses "Try it now".
  const moveFrom = OUTRO_CLICK - 0.85;
  const moveTo = OUTRO_CLICK - 0.2;
  const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut } as const;
  const cx = interpolate(t, [moveFrom, moveTo], [1500, 978], opts);
  const cy = interpolate(t, [moveFrom, moveTo], [920, 700], opts);
  const hover = clamp01((t - (moveTo - 0.12)) / 0.15);
  const cursorOn = clamp01((t - moveFrom) / 0.2);
  const press = t >= OUTRO_CLICK && t < OUTRO_CLICK + 0.14 ? 0.95 : 1;
  const ring = clamp01((t - OUTRO_CLICK) / 0.5);
  const glow = Math.sin(clamp01((t - OUTRO_CLICK) / 0.6) * Math.PI);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, opacity: orbIn, transform: `scale(${0.85 + 0.15 * orbIn})` }}>
        <Orb t={t} size={640} />
      </div>

      {SPOTS.map((s) => (
        <Character key={s.file} spot={s} t={t} />
      ))}
      <Sparkle x={620} y={250} size={34} at={START + 0.9} t={t} color="#7C3AED" />
      <Sparkle x={1300} y={230} size={24} at={START + 1.0} t={t} color="#C4B5FD" />
      <Sparkle x={640} y={860} size={22} at={START + 1.1} t={t} color="#C4B5FD" />
      <Sparkle x={1290} y={880} size={32} at={START + 1.2} t={t} color="#7C3AED" />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 22, ...rise(t, START + 0.2) }}>
          <div style={{ width: 112, height: 112, borderRadius: 30, boxShadow: '0 16px 44px -8px rgba(113,50,245,0.55)' }}>
            <LogoIcon size={112} />
          </div>
          <span style={{ fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 100, letterSpacing: '-0.025em', color: '#181622', lineHeight: 1 }}>
            Prompt<span style={{ color: '#7132F5' }}>Z</span>
          </span>
        </div>
        <div
          style={{
            marginTop: 38,
            fontFamily: CLASH,
            fontWeight: 600,
            fontSize: 44,
            letterSpacing: '0.005em',
            wordSpacing: '0.14em',
            color: '#18181B',
            ...rise(t, START + 0.45, 30),
          }}
        >
          From First Idea to Final Prompt - <span style={{ color: '#7C3AED' }}>In One Second</span>
        </div>
        <div style={{ marginTop: 54, ...rise(t, START + 0.7, 30) }}>
          <div
            style={{
              padding: '22px 52px',
              borderRadius: 18,
              background: '#7C3AED',
              color: '#FFFFFF',
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: '-0.01em',
              boxShadow: `0 ${10 + hover * 4}px ${30 + hover * 10 + glow * 30}px rgba(124,58,237,${0.4 + hover * 0.14 + glow * 0.2})`,
              transform: `scale(${(1 + hover * 0.03) * press})`,
            }}
          >
            Try it now
          </div>
        </div>
      </AbsoluteFill>

      {/* Click ring and cursor */}
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: cx - (12 + ring * 40),
            top: cy - (12 + ring * 40),
            width: (12 + ring * 40) * 2,
            height: (12 + ring * 40) * 2,
            borderRadius: '50%',
            border: '3px solid rgba(139, 92, 246, 0.85)',
            opacity: 1 - ring,
          }}
        />
      ) : null}
      {cursorOn > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: cx,
            top: cy,
            width: 15 + hover * 33,
            height: 15 + hover * 33,
            marginLeft: -(15 + hover * 33) / 2,
            marginTop: -(15 + hover * 33) / 2,
            borderRadius: '50%',
            background: hover > 0.5 ? 'transparent' : '#7C3AED',
            border: hover > 0.5 ? '3px solid #7C3AED' : 'none',
            boxShadow: '0 0 12px rgba(124,58,237,0.45)',
            opacity: cursorOn,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
