import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { LogoIcon } from '../components/Logo';
import { CLASH, INTER, MONTSERRAT } from './fonts';
import { clamp01, easeInOut, easeOut, TL } from './timing';

const START = TL.outro.start;
export const OUTRO_CLICK = 23.95;

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
    <div style={{ position: 'absolute', left: '50%', top: '44%', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, filter: 'blur(26px)', opacity: 0.7 }}>
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

export const Outro: React.FC<{ t: number }> = ({ t }) => {
  if (t < START) return null;
  const orbIn = easeInOut(clamp01((t - START - 0.1) / 0.9));

  // The site's cursor (purple dot → ring over the button) glides in and presses "Try it now".
  const cx = interpolate(t, [23.15, 23.8], [1480, 982], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut });
  const cy = interpolate(t, [23.15, 23.8], [880, 676], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut });
  const hover = clamp01((t - 23.62) / 0.15);
  const cursorOn = clamp01((t - 23.15) / 0.2);
  const press = t >= OUTRO_CLICK && t < OUTRO_CLICK + 0.14 ? 0.96 : 1;
  const ring = clamp01((t - OUTRO_CLICK) / 0.5);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, opacity: orbIn, transform: `scale(${0.85 + 0.15 * orbIn})` }}>
        <Orb t={t} size={620} />
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 22, ...rise(t, START + 0.25) }}>
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
            fontSize: 46,
            letterSpacing: '0.005em',
            wordSpacing: '0.14em',
            color: '#18181B',
            ...rise(t, START + 0.5, 30),
          }}
        >
          From First Idea to Final Prompt - <span style={{ color: '#7C3AED' }}>In One Second</span>
        </div>
        <div style={{ marginTop: 54, ...rise(t, START + 0.8, 30) }}>
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
              boxShadow: `0 ${10 + hover * 4}px ${30 + hover * 10}px rgba(124,58,237,${0.4 + hover * 0.14})`,
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
