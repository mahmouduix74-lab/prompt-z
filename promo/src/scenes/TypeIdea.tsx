import React from 'react';
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, SAFE, SCENES, type Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY } from '../copy';
import { caretOn, ease, graphemes, pop, typed, typedEnd } from '../anim';
import { Caption } from '../components/Caption';
import { Card, PrimaryButton, Tap, WandIcon } from '../components/Ui';

/* ------------------------------------------------------------------------------------------------
 * Scene 2 — "TypeIdea" (150 frames).
 * A phone-sized recreation of the site's prompt console (DomainSelector + ControlsBar depth tabs +
 * InputPanel), where the viewer sees a domain get tapped and a rough idea typed in.
 * ---------------------------------------------------------------------------------------------- */

// ---- Timeline (local frames) ----
const DUR = SCENES.type;
const TAP_START = 13; // Tap ring appears
const TAP_LEN = 26; // press lands at TAP_START + 0.4 * TAP_LEN ≈ 23
const SELECT_AT = 23; // purple indicator slides onto domains[1]
const FOCUS_AT = 30; // input panel takes focus (purple ring, caret starts blinking)
const TYPE_START = 38;
const TYPE_END = DUR - 24; // idea fully typed by here, then held on screen (sheen lands before the fade-out)
const CAPTION_DELAY = -2; // words are already rising while the scene slides in

// ---- Tailwind zinc / violet shades the site's components use (not all are in the shared theme) ----
const ZINC_100 = 'rgba(244,244,245,0.92)';
const ZINC_300 = '#D4D4D8';
const ZINC_600 = '#52525B';
const ZINC_700 = '#3F3F46';
const VIOLET_50 = '#F5F3FF';
const VIOLET_200_60 = 'rgba(221,214,254,0.9)';
const HAIRLINE = 'rgba(228,228,231,0.7)';

// Footer counter units, verbatim from the site's src/utils/i18n.ts (charCount / wordCount).
const COUNT_UNITS: Record<Lang, { chars: string; words: string }> = {
  en: { chars: 'chars', words: 'words' },
  ar: { chars: 'حرف', words: 'كلمة' },
};

// ---- Layout ----
const CARD_SIDE = 60; // card edge; inner padding keeps all text >= 72px from the frame edge
// The EN caption is two lines, the AR one is one line: sit the console just under each.
const CARD_TOP: Record<Lang, number> = { en: 548, ar: 482 };
const CAPTION_SIZE = 84; // Caption's default size
const CAPTION_LINE = CAPTION_SIZE * 1.15 + 4; // Caption's line height + row gap
const CHIP_FONT = 30;
const CHIP_RADIUS = 28;
// Domain scroller geometry, tuned per language (the Arabic labels are longer) so three chips are
// fully visible and the fourth peeks in with its icon under the end-edge fade, as a scroll hint.
const CHIP_PAD_X: Record<Lang, number> = { en: 28, ar: 20 };
const CHIP_GAP: Record<Lang, number> = { en: 14, ar: 12 };
const CHIP_FADE: Record<Lang, number> = { en: 104, ar: 92 };
const TEXT_SIZE = 44;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------------------------------------------
 * Icons — geometry copied from lucide-react 0.546.0 (the version the site ships), stroke-width 2.
 * ---------------------------------------------------------------------------------------------- */
const Icon: React.FC<{ size: number; color: string; children: React.ReactNode; strokeWidth?: number }> = ({
  size,
  color,
  children,
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    {children}
  </svg>
);

type IconProps = { size: number; color: string };

const LayersIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
    <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
  </Icon>
);

const LayoutIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </Icon>
);

const CodeIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m18 16 4-4-4-4" />
    <path d="m6 8-4 4 4 4" />
    <path d="m14.5 4-5 16" />
  </Icon>
);

const ServerIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </Icon>
);

const GaugeIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </Icon>
);

const PenLineIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M13 21h8" />
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  </Icon>
);

const InfoIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Icon>
);

const DOMAIN_ICONS: React.FC<IconProps>[] = [LayersIcon, LayoutIcon, CodeIcon, ServerIcon];

/* ------------------------------------------------------------------------------------------------
 * Domain chip — mirrors DomainSelector: white chip with icon + label; the selected one gets a solid
 * purple pill. The pill is a second copy of the chip clipped with clip-path, so the purple can
 * "slide" from one chip to the next (like the site's layoutId indicator) with crisp white text.
 * ---------------------------------------------------------------------------------------------- */
const DomainChip: React.FC<{
  label: string;
  IconCmp: React.FC<IconProps>;
  clip: string; // clip-path for the purple layer
  purpleOpacity: number;
  padX: number;
  scale?: number;
  children?: React.ReactNode;
}> = ({ label, IconCmp, clip, purpleOpacity, padX, scale = 1, children }) => {
  const face = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: `16px ${padX}px`,
    borderRadius: CHIP_RADIUS,
    fontSize: CHIP_FONT,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    color: selected ? '#FFFFFF' : ZINC_600,
    backgroundColor: selected ? C.purple : '#FFFFFF',
    border: `2px solid ${selected ? 'rgba(168,85,247,0.45)' : C.borderStrong}`,
  });
  return (
    <div style={{ position: 'relative', flexShrink: 0, transform: `scale(${scale})` }}>
      {/* soft glow under the purple pill, faded rather than clipped */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: CHIP_RADIUS,
          boxShadow: '0 14px 30px -10px rgba(124,58,237,0.6)',
          opacity: purpleOpacity,
        }}
      />
      <div style={{ ...face(false), boxShadow: '0 1px 3px rgba(24,24,27,0.06)' }}>
        <IconCmp size={32} color={C.muted} />
        <span>{label}</span>
      </div>
      <div style={{ ...face(true), position: 'absolute', inset: 0, clipPath: clip }}>
        <IconCmp size={32} color="#FFFFFF" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Scene
 * ---------------------------------------------------------------------------------------------- */
export const TypeIdea: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = COPY[lang];
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const units = COUNT_UNITS[lang];

  // ---- Camera: slow push-in over the whole scene ----
  const cam = interpolate(frame, [0, DUR], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  // ---- Staggered section entrance ----
  const enter = (delay: number) => pop(frame, fps, delay, 20, 0.8);
  const section = (delay: number, z = 1): React.CSSProperties => {
    const p = enter(delay);
    return {
      position: 'relative',
      zIndex: z,
      opacity: clamp01(p * 1.4),
      transform: `translateY(${(1 - p) * 44}px)`,
    };
  };
  const cardIn = enter(0);

  // ---- Domain selection ----
  const tapT = (frame - TAP_START) / TAP_LEN;
  const sel = pop(frame, fps, SELECT_AT, 15, 0.6); // may overshoot a hair
  const s = clamp01(sel);
  // Clip-path insets: the purple leaves chip 0 toward chip 1 and enters chip 1 from chip 0's side.
  // "Toward the next chip" is right in LTR, left in RTL.
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const clipLeaving = isAr
    ? `inset(0 ${pct(s)} 0 0 round ${CHIP_RADIUS}px)`
    : `inset(0 0 0 ${pct(s)} round ${CHIP_RADIUS}px)`;
  const clipEntering = isAr
    ? `inset(0 0 0 ${pct(1 - s)} round ${CHIP_RADIUS}px)`
    : `inset(0 ${pct(1 - s)} 0 0 round ${CHIP_RADIUS}px)`;
  const clipNone = `inset(0 0 0 100% round ${CHIP_RADIUS}px)`;
  const pressScale =
    frame < SELECT_AT
      ? interpolate(frame, [TAP_START + 3, SELECT_AT], [1, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0.95 + 0.05 * sel;

  // ---- Focus + typing ----
  const focus = ease(frame, FOCUS_AT, 12);
  const idea = copy.ui.idea;
  const perFrame = graphemes(idea).length / (TYPE_END - TYPE_START);
  const shown = typed(idea, frame, TYPE_START, perFrame);
  const doneAt = Math.min(typedEnd(idea, TYPE_START, perFrame), TYPE_END + 1);
  const isTyping = frame >= TYPE_START && frame < doneAt;
  const caretVisible = frame >= FOCUS_AT && (isTyping || caretOn(frame - FOCUS_AT));
  // In the Arabic render the idea ends with "Figma": wrap the caret in LRMs while the tail is Latin,
  // so it follows the Latin letters (to their right) instead of jumping to the far left of the line.
  // The idea's own direction, independent of the UI language (the English video types Arabic).
  const ideaRtl = /[\u0600-\u06FF]/.test(idea);
  const lastG = graphemes(shown).slice(-1)[0] ?? '';
  const latinTail = ideaRtl && /[A-Za-z]/.test(lastG);

  const chars = shown.length; // same measure as the site (rawText.length)
  const words = shown.trim() ? shown.trim().split(/\s+/).length : 0;

  // ---- Generate button: disabled (50%) until there is text; a "ready" bump + sheen once typed ----
  const active = ease(frame, TYPE_START, 8);
  const ready = ease(frame, doneAt, 14);
  const bump = interpolate(frame, [doneAt, doneAt + 6, doneAt + 18], [1, 1.035, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.33, 1, 0.68, 1),
  });
  const sheen = interpolate(frame, [doneAt + 1, doneAt + 17], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const inputBorder = interpolateColors(focus, [0, 1], [C.border, 'rgba(124,58,237,0.7)']);

  // Caption: one line per sentence, so the EN headline breaks as "Type your idea. / Any way you like."
  // (a single auto-wrapped Caption breaks after "Any"). Line 2 starts while line 1 is still landing,
  // so the whole headline is in place by ~frame 25 instead of ~30.
  const captionLines = copy.captions.type.split(/(?<=\.)\s+/);
  const captionDelays = captionLines.map((_, i) => CAPTION_DELAY + i * 6);
  const fade = CHIP_FADE[lang];
  const chipMask = `linear-gradient(${isAr ? 'to left' : 'to right'}, #000 0, #000 calc(100% - ${fade}px), transparent 100%)`;

  return (
    <AbsoluteFill dir={dir} style={{ backgroundColor: 'transparent' }}>
      {captionLines.map((line, i) => (
        <Caption
          key={i}
          text={line}
          lang={lang}
          delay={captionDelays[i]}
          top={SAFE.top + 20 + i * CAPTION_LINE}
          fontSize={CAPTION_SIZE}
          highlight={isAr ? ['فكرتك'] : ['idea.', 'Arabic.']}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: CARD_SIDE,
          right: CARD_SIDE,
          top: CARD_TOP[lang],
          transformOrigin: '50% 50%',
          transform: `translateY(${(1 - cardIn) * 60}px) scale(${cam * (0.97 + 0.03 * cardIn)})`,
        }}
      >
        <Card
          lang={lang}
          style={{
            padding: 36,
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            letterSpacing: isAr ? 0 : '-0.01em',
          }}
        >
          {/* 1. Domain selector */}
          <div style={section(1, 3)}>
            <div style={{ fontSize: 30, fontWeight: 600, color: ZINC_700, marginBottom: 16, paddingInline: 2 }}>
              {copy.ui.domainLabel}
            </div>
            {/* Horizontal scroller, as on the site's mobile layout: cut at the end edge with a fade.
                Vertical padding (cancelled by negative margin) keeps the tap ripple from being clipped. */}
            <div
              style={{
                display: 'flex',
                gap: CHIP_GAP[lang],
                padding: '90px 0',
                margin: '-90px 0',
                WebkitMaskImage: chipMask,
                maskImage: chipMask,
              }}
            >
              {copy.ui.domains.map((label, i) => (
                <DomainChip
                  key={i}
                  label={label}
                  IconCmp={DOMAIN_ICONS[i]}
                  clip={i === 0 ? clipLeaving : i === 1 ? clipEntering : clipNone}
                  purpleOpacity={i === 0 ? 1 - s : i === 1 ? s : 0}
                  padX={CHIP_PAD_X[lang]}
                  scale={i === 1 ? pressScale : 1}
                >
                  {i === 1 ? (
                    <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 5 }}>
                      <Tap x={0} y={0} t={tapT} />
                    </div>
                  ) : null}
                </DomainChip>
              ))}
            </div>
          </div>

          {/* 2. Detail depth (ControlsBar) */}
          <div
            style={{
              ...section(3, 2),
              padding: 24,
              borderRadius: 32,
              backgroundColor: 'rgba(255,255,255,0.7)',
              border: `2px solid ${C.border}`,
              boxShadow: '0 1px 3px rgba(24,24,27,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <GaugeIcon size={32} color={C.purple} />
              <span style={{ fontSize: 30, fontWeight: 500, color: ZINC_700 }}>{copy.ui.depthLabel}</span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  padding: '4px 14px',
                  borderRadius: 12,
                  color: C.purpleDeep,
                  backgroundColor: VIOLET_50,
                  border: `2px solid ${VIOLET_200_60}`,
                }}
              >
                {copy.ui.depths[1]}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                padding: 7,
                height: 92,
                boxSizing: 'border-box',
                borderRadius: 26,
                backgroundColor: ZINC_100,
                border: `2px solid ${C.border}`,
              }}
            >
              {copy.ui.depths.map((d, i) => {
                const on = i === 1;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 20,
                      fontSize: 30,
                      fontWeight: on ? 700 : 500,
                      color: on ? C.purpleDeep : ZINC_600,
                      backgroundColor: on ? '#FFFFFF' : 'transparent',
                      boxShadow: on ? '0 2px 6px rgba(24,24,27,0.08), 0 0 0 2px rgba(0,0,0,0.04)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Input panel */}
          <div
            style={{
              ...section(5, 1),
              borderRadius: 32,
              backgroundColor: 'rgba(255,255,255,0.72)',
              border: `2px solid ${inputBorder}`,
              boxShadow: `0 0 0 ${4 * focus}px rgba(124,58,237,${0.16 * focus}), 0 1px 3px rgba(24,24,27,0.05)`,
            }}
          >
            {/* header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '24px 30px',
                borderBottom: `2px solid ${HAIRLINE}`,
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '30px 30px 0 0',
              }}
            >
              <PenLineIcon size={34} color={C.purple} />
              <span style={{ fontSize: 31, fontWeight: 700, color: C.ink }}>{copy.ui.inputLabel}</span>
              <InfoIcon size={28} color={C.faint} />
            </div>

            {/* textarea */}
            <div
              dir={ideaRtl ? 'rtl' : 'ltr'}
              style={{
                fontFamily: FONTS.body(ideaRtl ? 'ar' : lang),
                padding: '28px 32px',
                minHeight: TEXT_SIZE * 1.5 * 2.5, // two lines of idea + breathing room, like an open textarea
                fontSize: TEXT_SIZE,
                fontWeight: 500,
                lineHeight: 1.5,
                color: C.ink,
                textAlign: 'start',
                overflowWrap: 'break-word',
              }}
            >
              {shown}
              {latinTail ? '‎' : null}
              <span
                style={{
                  display: 'inline-block',
                  width: 5,
                  height: '1.1em',
                  margin: '0 4px',
                  verticalAlign: '-0.2em',
                  borderRadius: 3,
                  backgroundColor: C.purple,
                  opacity: caretVisible ? 1 : 0,
                }}
              />
              {latinTail ? '‎' : null}
            </div>

            {/* footer (mobile layout: counts above, full-width Generate below) */}
            <div
              style={{
                padding: '22px 30px 28px',
                borderTop: `2px solid ${HAIRLINE}`,
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '0 0 30px 30px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  paddingBottom: 18,
                  marginBottom: 22,
                  borderBottom: `2px solid rgba(228,228,231,0.45)`,
                  fontFamily: FONTS.mono,
                  fontSize: 28,
                  color: C.muted,
                  letterSpacing: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  {chars} {units.chars}
                </span>
                <span style={{ color: ZINC_300 }}>•</span>
                <span>
                  {words} {units.words}
                </span>
              </div>

              <div style={{ position: 'relative', transform: `scale(${bump})` }}>
                <PrimaryButton
                  label={copy.ui.generate}
                  lang={lang}
                  fontSize={36}
                  icon={<WandIcon size={40} />}
                  style={{
                    width: '100%',
                    height: 108,
                    boxSizing: 'border-box',
                    borderRadius: 32,
                    letterSpacing: isAr ? 0 : '-0.01em',
                    opacity: 0.5 + 0.5 * active,
                    boxShadow: `0 ${14 + 10 * ready}px ${36 + 24 * ready}px -12px rgba(124,58,237,${0.45 + 0.25 * ready})`,
                  }}
                />
                {/* one light sheen across the button once the idea is in */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 32,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -20,
                      bottom: -20,
                      width: 160,
                      left: isAr ? `${interpolate(sheen, [0, 1], [110, -30])}%` : `${interpolate(sheen, [0, 1], [-30, 110])}%`,
                      transform: 'skewX(-20deg)',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)',
                      opacity: sheen > 0 && sheen < 1 ? 1 : 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};
