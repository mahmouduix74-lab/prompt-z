import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, SHADOW, type Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY } from '../copy';
import { pop, ease } from '../anim';
import { Caption } from '../components/Caption';
import { Card, Tap } from '../components/Ui';

// Layout (absolute px on the 1080x1920 canvas).
const CARD_X = 60;
const CARD_W = 960;
const PAD = 36;
const IDEA_TOP = 560;
const LANG_TOP = 850;
const FIELD_TOP = LANG_TOP + PAD + 44 + 24;
const FIELD_H = 100;
const FIELD_X = CARD_X + PAD;
const FIELD_W = CARD_W - PAD * 2;
const MENU_TOP = FIELD_TOP + FIELD_H + 14;
const OPTION_H = 96;
const MENU_PAD = 12;
const PICKED = 2; // "English"

// Beats (local frames).
const TAP1 = 10; // tap on the field; presses at TAP1 + 0.4 * TAP1_LEN
const TAP1_LEN = 26;
const OPEN_AT = 20;
const TAP2 = 30; // tap on "English"; presses at TAP2 + 0.4 * TAP2_LEN
const TAP2_LEN = 20;
const PICK_AT = 38;
const CLOSE_AT = 44;
const PILL_AT = 50;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const LanguagesIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const Chevron: React.FC<{ size: number; color: string; rotate: number }> = ({ size, color, rotate }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotate}deg)` }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PenIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </svg>
);

export const LanguagePick: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = COPY[lang];
  const ideaCopy = copy.ui.idea;
  const ideaRtl = /[؀-ۿ]/.test(ideaCopy);

  const ideaIn = pop(frame, fps, 0, 16, 0.8);
  const langIn = pop(frame, fps, 5, 16, 0.8);

  const open = frame < CLOSE_AT ? pop(frame, fps, OPEN_AT, 18, 0.6) : 1 - ease(frame, CLOSE_AT, 8);
  const picked = frame >= PICK_AT;
  const selected = picked ? PICKED : 0;
  const valueSwap = ease(frame, CLOSE_AT, 8);
  const fieldFocus = interpolate(frame, [OPEN_AT - 4, OPEN_AT, CLOSE_AT, CLOSE_AT + 10], [0, 1, 1, 0.35], clamp);
  const hoverEnglish = ease(frame, TAP2, 8);

  const pillIn = pop(frame, fps, PILL_AT, 14, 0.7);
  const arrowRun = interpolate(frame, [PILL_AT + 4, PILL_AT + 14], [0, 1], clamp);

  const fieldCenterY = FIELD_TOP + FIELD_H / 2;
  const englishCenterY = MENU_TOP + MENU_PAD + OPTION_H * PICKED + OPTION_H / 2;

  const rise = (p: number) => ({ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [50, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})` });

  return (
    <AbsoluteFill dir={copy.dir} style={{ backgroundColor: 'transparent' }}>
      <Caption text={copy.captions.language} lang={lang} delay={-2} highlight={lang === 'ar' ? ['المخرجات'] : ['output', 'language.']} />

      {/* The idea typed in the previous scene, for context */}
      <Card
        lang={lang}
        style={{ position: 'absolute', left: CARD_X, top: IDEA_TOP, width: CARD_W, padding: `28px ${PAD}px 32px`, ...rise(ideaIn) }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <PenIcon size={32} color={C.purple} />
          <span style={{ fontSize: 30, fontWeight: 700, color: C.inkSoft }}>{copy.ui.inputLabel}</span>
        </div>
        <div
          dir={ideaRtl ? 'rtl' : 'ltr'}
          style={{
            fontFamily: FONTS.body(ideaRtl ? 'ar' : 'en'),
            fontSize: 42,
            fontWeight: 500,
            lineHeight: 1.5,
            color: C.ink,
            textAlign: 'start',
          }}
        >
          {ideaCopy}
        </div>
      </Card>

      {/* Output language control (ControlsBar) */}
      <Card
        lang={lang}
        style={{ position: 'absolute', left: CARD_X, top: LANG_TOP, width: CARD_W, height: PAD * 2 + 44 + 24 + FIELD_H, ...rise(langIn) }}
      >
        <div style={{ position: 'absolute', top: PAD, insetInlineStart: PAD, display: 'flex', alignItems: 'center', gap: 14, height: 44 }}>
          <LanguagesIcon size={34} color={C.purple} />
          <span style={{ fontSize: 31, fontWeight: 700, color: C.ink }}>{copy.ui.outputLanguageLabel}</span>
        </div>
      </Card>

      {/* Field (outside the card element so the open menu can float above everything) */}
      <div
        style={{
          position: 'absolute',
          left: FIELD_X,
          top: FIELD_TOP,
          width: FIELD_W,
          height: FIELD_H,
          borderRadius: 24,
          backgroundColor: C.surface,
          border: `3px solid ${interpolate(fieldFocus, [0, 1], [0, 1]) > 0.5 ? C.purple : C.borderStrong}`,
          boxShadow: `0 0 0 ${fieldFocus * 8}px rgba(124,58,237,0.14), ${SHADOW.soft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 34px',
          fontFamily: FONTS.body(lang),
          fontSize: 38,
          fontWeight: 600,
          color: C.ink,
          ...rise(langIn),
        }}
      >
        <span style={{ position: 'relative', height: 50, flex: 1, overflow: 'hidden' }}>
          <span style={{ position: 'absolute', insetInlineStart: 0, top: 0, opacity: 1 - valueSwap, transform: `translateY(${-valueSwap * 40}px)` }}>
            {copy.ui.languages[0]}
          </span>
          <span
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              top: 0,
              opacity: valueSwap,
              transform: `translateY(${(1 - valueSwap) * 40}px)`,
              color: C.purple,
              fontWeight: 700,
            }}
          >
            {copy.ui.languages[PICKED]}
          </span>
        </span>
        <Chevron size={40} color={C.muted} rotate={open * 180} />
      </div>

      {/* Dropdown menu */}
      {open > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: FIELD_X,
            top: MENU_TOP,
            width: FIELD_W,
            padding: MENU_PAD,
            borderRadius: 28,
            backgroundColor: C.surface,
            border: `2px solid ${C.border}`,
            boxShadow: SHADOW.card,
            transformOrigin: 'top center',
            transform: `scaleY(${interpolate(open, [0, 1], [0.6, 1])}) translateY(${interpolate(open, [0, 1], [-20, 0])}px)`,
            opacity: Math.min(1, open * 1.4),
            fontFamily: FONTS.body(lang),
            zIndex: 10,
          }}
        >
          {copy.ui.languages.map((label, i) => {
            const isSel = i === selected;
            const highlight = i === PICKED ? hoverEnglish : 0;
            return (
              <div
                key={label}
                style={{
                  height: OPTION_H,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 26px',
                  fontSize: 36,
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? C.purple : C.inkSoft,
                  backgroundColor: `rgba(124,58,237,${0.1 * Math.max(highlight, isSel ? 1 : 0)})`,
                }}
              >
                <span>{label}</span>
                {isSel && <Check size={36} color={C.purple} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Payoff: Arabic in → English out */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: LANG_TOP + PAD * 2 + 44 + 24 + FIELD_H + 70,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 26,
          fontFamily: FONTS.body('en'),
          opacity: pillIn,
          transform: `translateY(${interpolate(pillIn, [0, 1], [30, 0])}px) scale(${interpolate(pillIn, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            padding: '18px 34px',
            borderRadius: 999,
            backgroundColor: C.surface,
            border: `2px solid ${C.borderStrong}`,
            boxShadow: SHADOW.soft,
            fontSize: 38,
            fontWeight: 700,
            color: C.inkSoft,
            fontFamily: FONTS.body('ar'),
          }}
        >
          عربي
        </div>
        <svg width={90} height={40} viewBox="0 0 90 40" fill="none">
          <path d={`M4 20 H${4 + 72 * arrowRun}`} stroke={C.purple} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 8 L82 20 L66 32" stroke={C.purple} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={arrowRun} />
        </svg>
        <div
          style={{
            padding: '18px 34px',
            borderRadius: 999,
            backgroundColor: C.purple,
            boxShadow: SHADOW.glow,
            fontSize: 38,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          English
        </div>
      </div>

      <Tap x={540} y={fieldCenterY} t={interpolate(frame, [TAP1, TAP1 + TAP1_LEN], [0, 1], clamp)} />
      <Tap x={540} y={englishCenterY} t={interpolate(frame, [TAP2, TAP2 + TAP2_LEN], [0, 1], clamp)} />
    </AbsoluteFill>
  );
};
