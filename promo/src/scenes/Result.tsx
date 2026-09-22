import React from 'react';
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS, SHADOW, VIDEO, Lang } from '../theme';
import { FONTS } from '../fonts';
import { COPY, PromptLine } from '../copy';
import { Caption } from '../components/Caption';
import { Card, Tap } from '../components/Ui';
import { graphemes, typed, pop, ease } from '../anim';

/*
 * Scene 4 "Result" — the structured prompt types itself into the output panel
 * (mirrors src/components/OutputPanel.tsx), the panel glows when it lands,
 * then the Copy button is tapped, turns green, and the copy toast slides up.
 */

// ---------- Layout ----------
const PANEL_X = 64;
const PANEL_W = VIDEO.width - PANEL_X * 2; // 952; text itself sits 44px further in (x >= 108)
const PAD_X = 44;
const HEADER_H = 112;
const BTN_W = 256;
const BTN_H = 76;
const BODY_PAD_Y = 34;
const SECTION_GAP = 18;
const LINE_H: Record<Lang, number> = { en: 56, ar: 60 };
const PANEL_TOP: Record<Lang, number> = { en: 520, ar: 446 };

// ---------- Timeline (local frames) ----------
const TYPE_START = 8;
const TYPE_DUR = 80; // every line of the prompt, both languages, lands in the same time
const TYPE_END = TYPE_START + TYPE_DUR;
const TAP_START = 92;
const TAP_LEN = 30; // Tap presses at 40% → local frame 124
const COPIED_AT = TAP_START + Math.round(TAP_LEN * 0.4);
const TOAST_AT = COPIED_AT + 3;

// Exact toast strings from OutputPanel.tsx on the site.
const TOAST: Record<Lang, { title: string; sub: string }> = {
  en: { title: 'Prompt Copied to Clipboard!', sub: 'Ready to paste into ChatGPT, Claude, or Gemini' },
  ar: { title: 'تم نسخ البرومبت بنجاح!', sub: 'جاهز للصق في ChatGPT أو Claude أو Gemini' },
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ---------- Icons (lucide paths, same set the site imports) ----------
const Svg: React.FC<{ size: number; color: string; stroke?: number; children: React.ReactNode }> = ({
  size,
  color,
  stroke = 2,
  children,
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
    style={{ display: 'block', flexShrink: 0 }}
  >
    {children}
  </svg>
);

const TerminalIcon: React.FC<{ size: number; color: string }> = (p) => (
  <Svg {...p} stroke={2.4}>
    <path d="M12 19h8" />
    <path d="m4 17 6-6-6-6" />
  </Svg>
);

const CopyIcon: React.FC<{ size: number; color: string }> = (p) => (
  <Svg {...p} stroke={2.2}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);

const CheckIcon: React.FC<{ size: number; color: string; draw?: number }> = ({ size, color, draw = 1 }) => (
  <Svg size={size} color={color} stroke={3}>
    {/* pathLength lets the tick draw itself in */}
    <path d="M20 6 9 17l-5-5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </Svg>
);

// ---------- Prompt schedule ----------
type Scheduled = PromptLine & { start: number; end: number };

const schedule = (lines: PromptLine[]): { rows: Scheduled[]; perFrame: number } => {
  const lens = lines.map((l) => graphemes(l.text).length);
  const total = lens.reduce((a, b) => a + b, 0);
  const perFrame = total / TYPE_DUR;
  let acc = 0;
  const rows = lines.map((l, i) => {
    const start = TYPE_START + acc / perFrame;
    acc += lens[i];
    return { ...l, start, end: TYPE_START + acc / perFrame };
  });
  return { rows, perFrame };
};

// ---------- One line of the structured prompt ----------
const PromptRow: React.FC<{
  row: Scheduled;
  index: number;
  lang: Lang;
  perFrame: number;
  frame: number;
  fps: number;
}> = ({ row, index, lang, perFrame, frame, fps }) => {
  const lineH = LINE_H[lang];
  const shown = typed(row.text, frame, row.start, perFrame);
  const typing = frame >= row.start && frame < row.end;
  const appear = ease(frame, row.start - 1, 6);
  const isHeader = row.kind === 'header';

  const caret = typing ? (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 36,
        marginInlineStart: 6,
        borderRadius: 3,
        backgroundColor: C.purple,
        verticalAlign: 'middle',
        transform: 'translateY(-2px)',
      }}
    />
  ) : null;

  const rowStyle: React.CSSProperties = {
    height: lineH,
    marginTop: isHeader && index > 0 ? SECTION_GAP : 0,
    display: 'flex',
    alignItems: 'center',
    opacity: appear,
    transform: `translateY(${interpolate(appear, [0, 1], [10, 0])}px)`,
    whiteSpace: 'pre',
  };

  if (isHeader) {
    // Headers are Latin and always read left-to-right ("# ROLE"), even in the RTL panel.
    // The untyped rest is laid out invisibly so the header keeps its final position while
    // typing: in the RTL panel it would otherwise creep leftwards from the right edge.
    const rest = graphemes(row.text).slice(graphemes(shown).length).join('');
    return (
      <div style={rowStyle}>
        <span
          dir="ltr"
          style={{
            display: 'inline-block',
            unicodeBidi: 'isolate',
            fontFamily: FONTS.mono,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: '0.02em',
            color: C.purple,
          }}
        >
          {shown}
          {typing && (
            <span style={{ position: 'relative', display: 'inline-block', width: 0, height: 36, verticalAlign: 'middle' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 4,
                  top: -2,
                  width: 14,
                  height: 36,
                  borderRadius: 3,
                  backgroundColor: C.purple,
                }}
              />
            </span>
          )}
          <span style={{ opacity: 0 }}>{rest}</span>
        </span>
      </div>
    );
  }

  const textStyle: React.CSSProperties =
    lang === 'ar'
      ? { fontFamily: FONTS.body('ar'), fontWeight: 500, fontSize: 34, color: C.ink }
      : { fontFamily: FONTS.mono, fontWeight: 500, fontSize: 34, color: C.ink };

  const dot = pop(frame, fps, row.start - 1, 12, 0.5);

  return (
    <div style={rowStyle}>
      {row.kind === 'bullet' && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: C.purple,
            boxShadow: '0 0 0 6px rgba(124,58,237,0.12)',
            marginInlineStart: 6,
            marginInlineEnd: 24,
            flexShrink: 0,
            transform: `scale(${dot})`,
          }}
        />
      )}
      <span style={textStyle}>
        {shown}
        {caret}
      </span>
    </div>
  );
};

// ---------- Copy button (idle purple → copied emerald) ----------
const CopyButton: React.FC<{ lang: Lang; frame: number; fps: number }> = ({ lang, frame, fps }) => {
  const ui = COPY[lang].ui;
  const toGreen = ease(frame, COPIED_AT, 7);
  const idleOut = ease(frame, COPIED_AT, 5);
  const copiedIn = Math.min(1, pop(frame, fps, COPIED_AT + 2, 12, 0.5));
  const press = interpolate(frame, [COPIED_AT - 6, COPIED_AT, COPIED_AT + 7], [1, 0.92, 1], clamp);

  const bg = interpolateColors(toGreen, [0, 1], [C.purple, C.emerald]);
  const glowColor = interpolateColors(toGreen, [0, 1], ['rgba(124,58,237,0.45)', 'rgba(5,150,105,0.45)']);

  const layer: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: BTN_W,
        height: BTN_H,
        flexShrink: 0,
        borderRadius: RADIUS.button,
        backgroundColor: bg,
        boxShadow: `0 14px 34px -10px ${glowColor}`,
        transform: `scale(${press})`,
        color: '#FFFFFF',
        fontFamily: FONTS.body(lang),
        fontWeight: 700,
        fontSize: 32,
      }}
    >
      <div style={{ ...layer, opacity: 1 - idleOut, transform: `scale(${1 - idleOut * 0.3})` }}>
        <CopyIcon size={32} color="#FFFFFF" />
        <span>{ui.copy}</span>
      </div>
      <div style={{ ...layer, opacity: copiedIn, transform: `scale(${0.7 + copiedIn * 0.3})` }}>
        <CheckIcon size={34} color="#FFFFFF" draw={ease(frame, COPIED_AT + 2, 10)} />
        <span>{ui.copied}</span>
      </div>
    </div>
  );
};

// ---------- Copy toast (dark pill with emerald accent, as on the site) ----------
const CopyToast: React.FC<{ lang: Lang; frame: number; fps: number; top: number }> = ({ lang, frame, fps, top }) => {
  if (frame < TOAST_AT) return null;
  const p = pop(frame, fps, TOAST_AT, 15, 0.8);
  const t = TOAST[lang];
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${interpolate(p, [0, 1], [32, 0])}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
      }}
    >
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          paddingBlock: 22,
          paddingInlineStart: 24,
          paddingInlineEnd: 36,
          borderRadius: 30,
          backgroundColor: 'rgba(9,9,11,0.95)',
          border: '2px solid rgba(16,185,129,0.45)',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,0.45), 0 0 44px rgba(16,185,129,0.25)',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(16,185,129,0.20)',
            border: '2px solid rgba(16,185,129,0.35)',
          }}
        >
          <CheckIcon size={36} color="#34D399" draw={ease(frame, TOAST_AT + 4, 12)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: FONTS.body(lang), fontWeight: 700, fontSize: 32, color: '#F4F4F5', lineHeight: 1.25 }}>
            {t.title}
          </span>
          <span style={{ fontFamily: FONTS.body(lang), fontWeight: 400, fontSize: 28, color: '#A1A1AA', lineHeight: 1.3 }}>
            {t.sub}
          </span>
        </div>
      </div>
    </div>
  );
};

// ---------- Scene ----------
export const Result: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = COPY[lang];
  const dir = copy.dir;
  const isAr = lang === 'ar';

  const { rows, perFrame } = schedule(copy.prompt);
  const lineH = LINE_H[lang];
  const headerCount = rows.filter((r, i) => r.kind === 'header' && i > 0).length;
  const bodyH = BODY_PAD_Y * 2 + rows.length * lineH + headerCount * SECTION_GAP;
  const panelH = HEADER_H + bodyH;
  const panelTop = PANEL_TOP[lang];
  const panelBottom = panelTop + panelH;

  // Entrance: the panel rises and settles while the Generate scene fades away.
  const enter = pop(frame, fps, 0, 16, 0.9);
  const drift = interpolate(frame, [0, 170], [0, 1], clamp);
  const panelScale = interpolate(enter, [0, 1], [0.94, 1]) * (1 + drift * 0.012);
  const panelY = interpolate(enter, [0, 1], [70, 0]);

  // Typing progress (header progress bar), completion glow, copy flash.
  const progress = interpolate(frame, [TYPE_START, TYPE_END], [0, 1], clamp);
  const barOpacity = interpolate(frame, [TYPE_END, TYPE_END + 10], [1, 0], clamp);
  const glow = interpolate(frame, [TYPE_END - 2, TYPE_END + 8, TYPE_END + 30, TYPE_END + 60], [0, 1, 0.75, 0.3], clamp);
  const flash = interpolate(frame, [COPIED_AT, COPIED_AT + 4, COPIED_AT + 24], [0, 1, 0], clamp);
  const sheen = interpolate(frame, [TYPE_END, TYPE_END + 22], [-0.4, 1.4], clamp);

  const borderColor = interpolateColors(
    flash,
    [0, 1],
    [interpolateColors(glow, [0, 1], [C.border, 'rgba(124,58,237,0.6)']), 'rgba(16,185,129,0.7)'],
  );
  const shadow = [
    SHADOW.card,
    `0 0 ${90 * glow}px ${-6 * glow}px rgba(124,58,237,${0.45 * glow})`,
    `0 0 0 ${8 * glow}px rgba(124,58,237,${0.1 * glow})`,
    `0 0 0 ${8 * flash}px rgba(16,185,129,${0.18 * flash})`,
  ].join(', ');

  // Tap lands on the centre of the Copy button (header end side), in panel coordinates.
  const btnCenterX = isAr ? PAD_X + BTN_W / 2 : PANEL_W - PAD_X - BTN_W / 2;
  const btnCenterY = HEADER_H / 2;
  const tapT = interpolate(frame, [TAP_START, TAP_START + TAP_LEN], [0, 1], clamp);

  return (
    <AbsoluteFill dir={dir} style={{ backgroundColor: 'transparent' }}>
      <Caption
        text={copy.captions.result}
        lang={lang}
        delay={2}
        highlight={isAr ? ['احترافي'] : ['English.']}
      />

      <div
        style={{
          position: 'absolute',
          left: PANEL_X,
          top: panelTop,
          width: PANEL_W,
          height: panelH,
          transform: `translateY(${panelY}px) scale(${panelScale})`,
          transformOrigin: '50% 40%',
        }}
      >
        <Card
          lang={lang}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: RADIUS.panel,
            border: `2px solid ${borderColor}`,
            boxShadow: shadow,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              position: 'relative',
              height: HEADER_H,
              paddingInline: PAD_X,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderBottom: '2px solid rgba(228,228,231,0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: C.purpleSoft,
                  border: '2px solid rgba(124,58,237,0.18)',
                }}
              >
                <TerminalIcon size={32} color={C.purple} />
              </div>
              <span style={{ fontFamily: FONTS.body(lang), fontWeight: 700, fontSize: 34, color: C.ink, whiteSpace: 'nowrap' }}>
                {copy.ui.outputLabel}
              </span>
            </div>
            <CopyButton lang={lang} frame={frame} fps={fps} />

            {/* Streaming progress along the header's bottom edge */}
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                insetInlineStart: 0,
                height: 4,
                width: `${progress * 100}%`,
                borderRadius: 2,
                background: `linear-gradient(${isAr ? 270 : 90}deg, ${C.purple}, ${C.lilac})`,
                opacity: barOpacity,
              }}
            />
          </div>

          {/* Body: the structured prompt */}
          <div
            dir={dir}
            style={{
              position: 'relative',
              height: bodyH,
              paddingInline: PAD_X,
              paddingBlock: BODY_PAD_Y,
              backgroundColor: interpolateColors(flash, [0, 1], ['rgba(255,255,255,0.2)', 'rgba(5,150,105,0.035)']),
              textAlign: 'start',
            }}
          >
            {/* One soft lilac sheen sweeps behind the text when the prompt lands */}
            {sheen > -0.4 && sheen < 1.4 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(isAr ? 1 - sheen : sheen) * 100}%`, // sweeps in reading direction
                  width: '40%',
                  transform: 'translateX(-50%) skewX(-18deg)',
                  background:
                    'linear-gradient(90deg, rgba(237,233,254,0) 0%, rgba(221,214,254,0.75) 50%, rgba(237,233,254,0) 100%)',
                  zIndex: 0,
                }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {rows.map((row, i) => (
                <PromptRow key={i} row={row} index={i} lang={lang} perFrame={perFrame} frame={frame} fps={fps} />
              ))}
            </div>
          </div>
        </Card>

        <Tap x={btnCenterX} y={btnCenterY} t={tapT} />
      </div>

      <CopyToast lang={lang} frame={frame} fps={fps} top={panelBottom - 14} />
    </AbsoluteFill>
  );
};
