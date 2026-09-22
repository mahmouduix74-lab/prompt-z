import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, SAFE, SHADOW, VIDEO, Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY } from '../copy';
import { pop } from '../anim';
import { LogoIcon, Wordmark } from '../components/Logo';
import { PrimaryButton } from '../components/Ui';

/*
 * Scene 5 — end card (130 frames).
 * Timeline (local frames):
 *   1-22   logo icon springs in, wordmark unfolds from behind it
 *   8-40   the four site characters pop in (reading order), then float gently
 *   12-36  tagline rises word by word, second half in purple
 *   24-40  CTA pill springs in; 48-74 one sheen sweep; 74-88 arrow nudge
 *   30-46  URL pill rises
 *   90-129 everything settled: a clean, screenshot-able frame (float is ~3px)
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const ICON = 168;
const WORD = 136;
const LOCKUP_GAP = 30;
const CHAR = 250;

// ---------------------------------------------------------------- icons

const ArrowIcon: React.FC<{ size: number; mirror: boolean; nudge: number }> = ({ size, mirror, nudge }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#FFFFFF"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: `translateX(${mirror ? -nudge : nudge}px) scaleX(${mirror ? -1 : 1})`, flexShrink: 0 }}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const GlobeIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

/** Four-point sparkle, like the rays around the site's icon. */
const Sparkle: React.FC<{ x: number; y: number; size: number; delay: number; color: string }> = ({ x, y, size, delay, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay, 9, 0.6);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        opacity: Math.min(1, p * 1.4),
        transform: `scale(${p}) rotate(${(1 - p) * 90}deg)`,
      }}
    >
      <path d="M12 0C12.9 7.1 16.9 11.1 24 12 16.9 12.9 12.9 16.9 12 24 11.1 16.9 7.1 12.9 0 12 7.1 11.1 11.1 7.1 12 0Z" fill={color} />
    </svg>
  );
};

// ---------------------------------------------------------------- lockup

/** The LogoLockup (icon + wordmark), animated in two parts: the icon lands, then the wordmark unfolds beside it. */
const AnimatedLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iconP = pop(frame, fps, 1, 11, 0.8);
  const wordP = pop(frame, fps, 7, 20, 1);
  const ring = interpolate(frame, [8, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });

  return (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: ICON,
          height: ICON,
          flexShrink: 0,
          opacity: Math.min(1, iconP * 2),
          transform: `translateY(${(1 - iconP) * 60}px) scale(${0.3 + 0.7 * iconP}) rotate(${(1 - iconP) * -24}deg)`,
        }}
      >
        {/* soft purple bloom behind the icon */}
        <div
          style={{
            position: 'absolute',
            inset: -70,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, rgba(124,58,237,0.10) 45%, rgba(124,58,237,0) 70%)',
          }}
        />
        {/* one landing pulse */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: ICON * (36 / 128),
            border: `3px solid ${C.purple}`,
            transform: `scale(${1.05 + ring * 0.9})`,
            opacity: ring > 0 && ring < 1 ? (1 - ring) * (1 - ring) * 0.5 : 0,
          }}
        />
        <div
          style={{
            position: 'relative',
            width: ICON,
            height: ICON,
            borderRadius: ICON * (36 / 128),
            boxShadow: '0 28px 60px -14px rgba(113, 50, 245, 0.55), 0 6px 16px -6px rgba(24, 24, 27, 0.18)',
          }}
        >
          <LogoIcon size={ICON} />
        </div>
      </div>
      {/* The wordmark lives in a clipping box whose max width springs open, so the whole
          lockup stays centred and the icon glides aside as the name unfolds. */}
      <div
        style={{
          display: 'flex',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: wordP * 640,
          padding: '28px 0',
        }}
      >
        <div
          style={{
            paddingLeft: LOCKUP_GAP,
            paddingRight: 6,
            opacity: Math.min(1, wordP * 1.6),
            transform: `translateX(${(1 - wordP) * -60}px)`,
          }}
        >
          <Wordmark fontSize={WORD} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- tagline

/** Tagline split at its dash into two lines: the promise in ink, the payoff in purple. */
const Tagline: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';
  const text = COPY[lang].outro.tagline;
  const parts = text.split(/\s+[-–—]\s+/);
  const lines = parts.length === 2 ? parts : [text];

  let index = 0;
  const lineWords = lines.map((line) => line.split(' ').map((w) => ({ w, i: index++ })));

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        width: '100%',
        maxWidth: 900,
        textAlign: 'center',
        fontFamily: FONTS.display(lang),
        fontWeight: 600,
        fontSize: isAr ? 58 : 52,
        lineHeight: isAr ? 1.4 : 1.16,
        // Clash Display's space is narrow; open it up a touch (Latin only, never on Arabic).
        wordSpacing: isAr ? undefined : '0.08em',
      }}
    >
      {lineWords.map((words, li) => (
        <div key={li} style={{ textWrap: 'balance', color: li === 1 ? C.purple : C.ink }}>
          {words.map(({ w, i }, wi) => {
            const p = pop(frame, fps, 12 + i * 2, 18, 0.6);
            return (
              <React.Fragment key={wi}>
                <span
                  style={{
                    display: 'inline-block',
                    opacity: Math.min(1, p * 1.3),
                    transform: `translateY(${(1 - p) * 34}px)`,
                    filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined,
                  }}
                >
                  {w}
                </span>
                {wi < words.length - 1 ? ' ' : null}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- CTA + URL

const Cta: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAr = lang === 'ar';
  const p = pop(frame, fps, 24, 12, 0.8);
  // One sheen pass, sweeping in the reading direction.
  const s = interpolate(frame, [48, 74], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const sheenLeft = isAr ? interpolate(s, [0, 1], [108, -46]) : interpolate(s, [0, 1], [-46, 108]);
  // A single nudge of the arrow after the sheen, back at rest well before the final hold.
  const nudge = Math.sin(interpolate(frame, [74, 88], [0, Math.PI], clamp)) * 10;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        opacity: Math.min(1, p * 1.6),
        transform: `translateY(${(1 - p) * 50}px) scale(${0.82 + 0.18 * p})`,
      }}
    >
      <PrimaryButton
        lang={lang}
        label={COPY[lang].outro.cta}
        fontSize={46}
        icon={
          <>
            <div
              style={{
                position: 'absolute',
                top: -20,
                bottom: -20,
                left: `${sheenLeft}%`,
                width: '38%',
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
                transform: `skewX(${isAr ? 20 : -20}deg)`,
                opacity: s > 0 && s < 1 ? 1 : 0,
                pointerEvents: 'none',
              }}
            />
            <ArrowIcon size={46} mirror={isAr} nudge={nudge} />
          </>
        }
        style={{
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'row-reverse',
          borderRadius: 999,
          padding: '30px 66px',
          gap: 20,
          boxShadow: '0 24px 60px -12px rgba(124, 58, 237, 0.60), 0 6px 18px -6px rgba(76, 29, 149, 0.30)',
        }}
      />
    </div>
  );
};

const UrlPill: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, 30, 16, 0.8);
  return (
    <div
      dir="ltr"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 34px',
        borderRadius: 999,
        backgroundColor: C.surfaceSoft,
        border: `2px solid ${C.border}`,
        boxShadow: SHADOW.soft,
        backdropFilter: 'blur(24px)',
        fontFamily: FONTS.body('en'),
        fontWeight: 600,
        fontSize: 34,
        letterSpacing: '-0.01em',
        color: C.inkSoft,
        whiteSpace: 'nowrap',
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 36}px)`,
      }}
    >
      <GlobeIcon size={34} color={C.purple} />
      <span>{COPY[lang].outro.url}</span>
    </div>
  );
};

// ---------------------------------------------------------------- characters

type CharacterSpot = {
  file: string;
  /** left edge in the LTR layout; mirrored for Arabic */
  x: number;
  y: number;
  delay: number;
  phase: number;
};

const LEFT = 96;
const RIGHT = VIDEO.width - LEFT - CHAR;

// Reading order: top-start, top-end, bottom-start, bottom-end. Characters on the right are
// flipped so all four face the lockup (the site's <Character flip /> does the same).
const SPOTS: CharacterSpot[] = [
  { file: 'create-character.svg', x: LEFT, y: 296, delay: 8, phase: 0 },
  { file: 'explore-character.svg', x: RIGHT, y: 326, delay: 13, phase: 1.6 },
  { file: 'customize-character.svg', x: LEFT, y: 1292, delay: 18, phase: 3.1 },
  { file: 'organize-character.svg', x: RIGHT, y: 1276, delay: 23, phase: 4.5 },
];

const FloatingCharacter: React.FC<{ spot: CharacterSpot; lang: Lang }> = ({ spot, lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = lang === 'ar' ? VIDEO.width - spot.x - CHAR : spot.x;
  const facesLeft = x > VIDEO.width / 2;
  const p = pop(frame, fps, spot.delay, 10, 0.8);
  // Gentle idle float that calms down for the final still-looking hold.
  const amp = interpolate(frame, [70, 104], [10, 3], clamp);
  const t = (frame / fps) * ((Math.PI * 2) / 3.2) + spot.phase;
  const float = Math.sin(t) * amp;
  const sway = Math.sin(t * 0.7 + 1) * interpolate(frame, [70, 104], [2.2, 0.8], clamp);
  const enterTilt = (1 - p) * (facesLeft ? 28 : -28);

  return (
    <div style={{ position: 'absolute', left: x, top: spot.y, width: CHAR, height: CHAR }}>
      {/* white halo so the line art reads cleanly over the purple glows */}
      <div
        style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.65) 42%, rgba(255,255,255,0) 70%)',
          opacity: p,
          transform: `translateY(${float * 0.5}px) scale(${0.4 + 0.6 * p})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: Math.min(1, p * 2),
          transform: `translateY(${(1 - p) * 90 + float}px) scale(${0.25 + 0.75 * p}) rotate(${enterTilt + sway}deg)`,
        }}
      >
        <Img
          src={staticFile(spot.file)}
          style={{ width: CHAR, height: CHAR, transform: facesLeft ? 'scaleX(-1)' : undefined }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- scene

export const Outro: React.FC<{ lang: Lang }> = ({ lang }) => {
  const isAr = lang === 'ar';
  return (
    <AbsoluteFill dir={isAr ? 'rtl' : 'ltr'} style={{ backgroundColor: 'transparent' }}>
      {SPOTS.map((spot) => (
        <FloatingCharacter key={spot.file} spot={spot} lang={lang} />
      ))}

      {/* sparkles in the open space between the characters */}
      <Sparkle x={540} y={400} size={40} delay={16} color={C.purple} />
      <Sparkle x={470} y={470} size={22} delay={21} color={C.lilac} />
      <Sparkle x={612} y={1420} size={34} delay={27} color={C.purple} />
      <Sparkle x={540} y={1480} size={20} delay={31} color={C.lilac} />

      <div
        style={{
          position: 'absolute',
          left: SAFE.side,
          right: SAFE.side,
          top: 570,
          height: 710,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatedLockup />
        <div style={{ height: 26 }} />
        <Tagline lang={lang} />
        <div style={{ height: 62 }} />
        <Cta lang={lang} />
        <div style={{ height: 30 }} />
        <UrlPill lang={lang} />
      </div>
    </AbsoluteFill>
  );
};
