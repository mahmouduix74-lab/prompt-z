import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, SAFE, SCENES, SHADOW, Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY } from '../copy';
import { ease, graphemes, pop } from '../anim';
import { LogoIcon, Wordmark } from '../components/Logo';

/*
 * Scene 1 — Hook (80 frames).
 * Logo lockup pops in, then the site's hero headline with its looping purple
 * typewriter word (HeroSection.tsx → LoopingTitle), the hero lead underneath,
 * the site's rotating gradient orb behind it, and the Explore character
 * peeking up from a soft fade at the bottom safe line (above the Reels UI).
 */

// ---- Timeline (local frames) ------------------------------------------------
const T = {
  icon: 0,
  wordmark: 5,
  prefix: 6,
  slot: 8,
  suffix: 10,
  type1: 11,
  lead: 12,
  character: 18,
  delete: 36,
} as const;

// Bottom of the area the logo + headline + lead are centred in; the character stage sits below it.
const TEXT_BOTTOM = 1190;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Frames spent typing / deleting a word, scaled with its length but kept snappy.
const typeFrames = (len: number) => clamp(len * 2, 6, 10);
const deleteFrames = (len: number) => clamp(len, 3, 6);

type WordState = { index: number; count: number; busy: boolean; idleSince: number };

/** Deterministic replay of LoopingTitle: type word 0, hold, delete it, type word 1, hold. */
const wordState = (frame: number, words: string[]): WordState => {
  const w0 = graphemes(words[0]).length;
  const w1 = graphemes(words[1] ?? words[0]).length;
  const t0End = T.type1 + typeFrames(w0);
  const dEnd = T.delete + deleteFrames(w0);
  const t1Start = dEnd + 3;
  const t1End = t1Start + typeFrames(w1);

  if (frame < T.type1) return { index: 0, count: 0, busy: false, idleSince: T.slot };
  if (frame < t0End) {
    const n = Math.floor(((frame - T.type1) / typeFrames(w0)) * w0) + 1;
    return { index: 0, count: clamp(n, 0, w0), busy: true, idleSince: frame };
  }
  if (frame < T.delete) return { index: 0, count: w0, busy: false, idleSince: t0End };
  if (frame < dEnd) {
    const gone = Math.floor(((frame - T.delete) / deleteFrames(w0)) * w0) + 1;
    return { index: 0, count: clamp(w0 - gone, 0, w0), busy: true, idleSince: frame };
  }
  if (frame < t1Start) return { index: 1, count: 0, busy: true, idleSince: frame };
  if (frame < t1End) {
    const n = Math.floor(((frame - t1Start) / typeFrames(w1)) * w1) + 1;
    return { index: 1, count: clamp(n, 0, w1), busy: true, idleSince: frame };
  }
  return { index: 1, count: w1, busy: false, idleSince: t1End };
};

// ---- Pieces -----------------------------------------------------------------

/** The site's rotating two-disc gradient orb (xtract-hero.css → .xhero-orb), driven by frame. */
const Orb: React.FC<{ frame: number; size: number; top: number }> = ({ frame, size, top }) => {
  const inP = ease(frame, 0, 26);
  const inner = size * (320 / 480);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity: 0.5 * inP,
        filter: 'blur(28px)',
        transform: `scale(${interpolate(inP, [0, 1], [0.7, 1])})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'linear-gradient(229deg, #c084fc 13%, rgba(192, 132, 252, 0) 35.02%, rgba(168, 85, 247, 0) 64.17%, #7c3aed 88%)',
          transform: `rotate(${(-360 * frame) / 300}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: inner,
          height: inner,
          marginLeft: -inner / 2,
          marginTop: -inner / 2,
          borderRadius: '50%',
          background:
            'linear-gradient(141deg, #d8b4fe 13%, rgba(216, 180, 254, 0) 35.02%, rgba(147, 51, 234, 0) 64.17%, #9333ea 88%)',
          transform: `rotate(${(360 * frame) / 360}deg)`,
        }}
      />
    </div>
  );
};

/** Icon springs from 0 with a slight rotate; the wordmark slides out from behind it. Always LTR. */
const Lockup: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const iconSize = 132;
  const s = pop(frame, fps, T.icon, 10, 0.8);
  const w = ease(frame, T.wordmark, 18);
  return (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize * (36 / 128),
          boxShadow: SHADOW.glow,
          transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [-28, 0])}deg)`,
        }}
      >
        <LogoIcon size={iconSize} />
      </div>
      <div style={{ overflow: 'hidden', padding: '14px 8px 22px 0', margin: '-14px -8px -22px 0' }}>
        <div
          style={{
            transform: `translateX(${interpolate(w, [0, 1], [-110, 0])}%)`,
            opacity: interpolate(w, [0, 0.35, 1], [0, 1, 1]),
          }}
        >
          <Wordmark fontSize={92} />
        </div>
      </div>
    </div>
  );
};

/** Rise with a blur, like the site's .xhero-word entrance. */
const Rise: React.FC<{ frame: number; fps: number; delay: number; children: React.ReactNode; distance?: number }> = ({
  frame,
  fps,
  delay,
  children,
  distance = 60,
}) => {
  const p = pop(frame, fps, delay, 16, 0.8);
  return (
    <div
      style={{
        opacity: clamp(p * 1.4, 0, 1),
        transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
        filter: `blur(${interpolate(p, [0, 0.75], [14, 0], { extrapolateRight: 'clamp' })}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** Thin purple forge cursor from LoopingTitle (w-[4px] h-[0.9em] mx-1 rounded-full, purple glow). */
const Caret: React.FC<{ fontSize: number; opacity: number }> = ({ fontSize, opacity }) => (
  <span
    style={{
      display: 'inline-block',
      width: Math.round(fontSize * 0.065),
      height: fontSize * 0.9,
      marginInline: Math.round(fontSize * 0.08),
      borderRadius: 999,
      backgroundColor: C.purple,
      boxShadow: '0 0 14px rgba(168,85,247,0.8)',
      opacity,
      flexShrink: 0,
    }}
  />
);

/**
 * The looping purple word. The slot always reserves the full width of the word being
 * typed, so the typed text grows from its final start edge instead of shifting the line.
 */
const TypedWord: React.FC<{ frame: number; lang: Lang; fontSize: number }> = ({ frame, lang, fontSize }) => {
  const { words } = COPY[lang].hero;
  const st = wordState(frame, words);
  const target = words[st.index];
  const shown = graphemes(target).slice(0, st.count).join('');
  const idle = frame - st.idleSince;
  const caretOpacity = st.busy ? 1 : 0.3 + 0.7 * (0.5 + 0.5 * Math.cos((2 * Math.PI * idle) / 22));
  const caretSpace = Math.round(fontSize * 0.065) + 2 * Math.round(fontSize * 0.08);

  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', color: C.purple }}>
      {/* Invisible reservation: full word + caret */}
      <span style={{ visibility: 'hidden' }}>
        {target}
        <span style={{ display: 'inline-block', width: caretSpace }} />
      </span>
      <span
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          insetInlineStart: 0,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{shown}</span>
        <Caret fontSize={fontSize} opacity={caretOpacity} />
      </span>
    </span>
  );
};

/** Explore character with the site's lavender body fill underneath the line art (Character.tsx). */
const ExploreCharacter: React.FC<{ size: number; flip: boolean }> = ({ size, flip }) => (
  <div style={{ position: 'relative', width: size, height: size, transform: flip ? 'scaleX(-1)' : undefined }}>
    <svg width={size} height={size} viewBox="0 0 256 256" style={{ position: 'absolute', inset: 0 }}>
      <g transform="translate(-839 -141) scale(1.1)">
        <path
          d="M 823 244 C 825 218 839 194 861 186 C 879 179 892 182 901 190 C 915 205 918 230 918 260 C 917 280 920 305 921 329 C 880 330 830 330 789 323 C 794 293 811 266 827 250 Z"
          fill="#F1EAFF"
        />
      </g>
    </svg>
    <Img src={staticFile('explore-character.svg')} style={{ position: 'absolute', inset: 0, width: size, height: size }} />
  </div>
);

// ---- Scene --------------------------------------------------------------------

export const Hook: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = COPY[lang];
  const isAr = lang === 'ar';

  const headSize = isAr ? 118 : 124;
  const headStyle: React.CSSProperties = {
    fontFamily: FONTS.display(lang),
    fontWeight: 700,
    fontSize: headSize,
    lineHeight: isAr ? 1.32 : 1.02,
    letterSpacing: isAr ? 0 : '-0.025em',
    color: C.ink,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };

  // Lead: split at the " - " so each half gets its own line (no words changed).
  const [leadA, leadB] = copy.hero.lead.includes(' - ') ? copy.hero.lead.split(' - ') : [copy.hero.lead, ''];
  const leadStyle: React.CSSProperties = {
    fontFamily: FONTS.body(lang),
    fontSize: 42,
    lineHeight: isAr ? 1.6 : 1.4,
    letterSpacing: 0,
    textAlign: 'center',
  };

  // Slow camera push for life while everything holds.
  const push = interpolate(frame, [0, SCENES.hook], [1, 1.04]);

  // Character peeks up from behind a soft horizon at the bottom safe line, then idles with a gentle bob.
  // The horizon is a fixed fade mask, so the body dissolves before the Reels UI and never shows a cut edge.
  const horizon = 1920 - SAFE.bottom + 10; // y where the character fully fades out
  const stage = 470; // height of the masked stage above the horizon
  const charSize = 600;
  const cp = pop(frame, fps, T.character, 13, 0.9);
  const settle = clamp((frame - T.character - 12) / 10, 0, 1);
  const bob = Math.sin(((frame - T.character) / fps) * Math.PI * 1.3) * 7 * settle;
  const charY = interpolate(cp, [0, 1], [380, 0]) + bob;
  const charTilt = interpolate(cp, [0, 1], [isAr ? -8 : 8, 0]) + Math.sin(((frame - T.character) / fps) * Math.PI) * 1.5 * settle;

  return (
    <AbsoluteFill dir={isAr ? 'rtl' : 'ltr'} style={{ backgroundColor: 'transparent' }}>
      <Orb frame={frame} size={820} top={760} />

      {/* Character stage: fixed in screen space, fading to nothing at the horizon. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: horizon - stage,
          height: stage,
          overflow: 'hidden',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 1150 - (horizon - stage),
            marginLeft: -charSize / 2,
            transform: `translateY(${charY}px) rotate(${charTilt}deg)`,
            transformOrigin: '50% 80%',
          }}
        >
          <ExploreCharacter size={charSize} flip={isAr} />
        </div>
      </div>

      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 45%' }}>
        {/* Text block, vertically centred between the top safe line and the character stage. */}
        <div
          style={{
            position: 'absolute',
            top: SAFE.top,
            height: TEXT_BOTTOM - SAFE.top,
            left: SAFE.side,
            right: SAFE.side,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lockup frame={frame} fps={fps} />

          <div style={{ height: 96 }} />

          <div style={{ ...headStyle, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Rise frame={frame} fps={fps} delay={T.prefix}>
              <span>{copy.hero.prefix}</span>
            </Rise>
            <Rise frame={frame} fps={fps} delay={T.slot}>
              <TypedWord frame={frame} lang={lang} fontSize={headSize} />
            </Rise>
            {copy.hero.suffix ? (
              <Rise frame={frame} fps={fps} delay={T.suffix}>
                <span>{copy.hero.suffix}</span>
              </Rise>
            ) : null}
          </div>

          <div style={{ height: isAr ? 44 : 56 }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 920 }}>
            <Rise frame={frame} fps={fps} delay={T.lead} distance={36}>
              <div style={{ ...leadStyle, fontWeight: 500, color: C.inkSoft }}>{leadA}</div>
            </Rise>
            {leadB ? (
              <Rise frame={frame} fps={fps} delay={T.lead + 2} distance={36}>
                <div style={{ ...leadStyle, fontWeight: 700, color: C.purple }}>{leadB}</div>
              </Rise>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
