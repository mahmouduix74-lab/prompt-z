import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { LogoIcon } from '../components/Logo';
import { BAR, FPS, LAST_CAPTURED, MACROS, META, REVEALS, TL, VIEW, WIN, clamp01, easeInOut, easeOut, mouseAt, rect, type Rect, type Theme } from './timing';
import { INTER } from './fonts';

// Page and chrome colours per theme, from the site (bg #FAFAFC / #070709) and macOS window chrome.
export const THEME = {
  light: {
    stage: 'radial-gradient(120% 90% at 50% 0%, #F7F4FE 0%, #ECE7F7 55%, #E4DDF3 100%)',
    glow: 'rgba(147, 51, 234, 0.22)',
    bar: '#F2F1F6',
    barBorder: 'rgba(0,0,0,0.08)',
    pill: 'rgba(0,0,0,0.05)',
    title: '#3F3F46',
    shadow: '0 50px 120px -30px rgba(76, 29, 149, 0.35), 0 18px 40px -18px rgba(24, 24, 27, 0.25)',
    frame: 'rgba(0,0,0,0.10)',
  },
  dark: {
    stage: 'radial-gradient(120% 90% at 50% 0%, #1A1426 0%, #0C0A12 60%, #07060A 100%)',
    glow: 'rgba(139, 92, 246, 0.28)',
    bar: '#1C1B22',
    barBorder: 'rgba(255,255,255,0.06)',
    pill: 'rgba(255,255,255,0.07)',
    title: '#D4D4D8',
    shadow: '0 50px 120px -30px rgba(0, 0, 0, 0.8), 0 0 80px -20px rgba(139, 92, 246, 0.35)',
    frame: 'rgba(255,255,255,0.10)',
  },
} as const;

/** Where the theme stands at time t: the theme underneath, and the one revealing on top (0–1). */
export const themeAt = (t: number): { base: Theme; top: Theme | null; p: number } => {
  let base: Theme = 'light';
  for (const r of REVEALS) {
    if (t < r.at) break;
    const p = easeInOut(clamp01((t - r.at) / TL.revealDuration));
    if (p < 1) return { base: r.from, top: r.to, p };
    base = r.to;
  }
  return { base, top: null, p: 0 };
};

// Reveal circle, centred on the header's theme toggle (viewport px).
const toggle = rect('toggle');
const ORIGIN = { x: toggle.x + toggle.w / 2, y: toggle.y + toggle.h / 2 };
const MAX_R = Math.hypot(ORIGIN.x, VIEW.height - ORIGIN.y) + 40;

/** Stage backdrop, cross-faded with the page theme. */
export const Stage: React.FC<{ t: number }> = ({ t }) => {
  // The end card sits on the light stage, whatever the page ended on.
  const toLight = easeInOut(clamp01((t - TL.outro.start + 0.2) / 0.7));
  const page = themeAt(t);
  const th = toLight > 0 && page.base === 'dark' && !page.top ? { base: 'dark' as Theme, top: 'light' as Theme, p: toLight } : page;
  const layer = (theme: Theme, opacity: number) => (
    <AbsoluteFill style={{ background: THEME[theme].stage, opacity }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: 1500,
          height: 900,
          marginLeft: -750,
          marginTop: -450,
          borderRadius: '50%',
          background: THEME[theme].glow,
          filter: 'blur(160px)',
          transform: `translate(${Math.sin(t * 0.35) * 40}px, ${Math.cos(t * 0.3) * 30}px)`,
        }}
      />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      {layer(th.base, 1)}
      {th.top ? layer(th.top, th.p) : null}
    </AbsoluteFill>
  );
};

const frameIndex = (t: number) => Math.max(0, Math.min(LAST_CAPTURED, Math.round(t * FPS)));
const frameSrc = (theme: Theme, t: number) => staticFile(`capture/${theme}/f${String(frameIndex(t)).padStart(4, '0')}.jpg`);

const IMG: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: VIEW.width, height: VIEW.height };

/** One theme's page at time t, with any 4× close-up pass laid exactly over its region. */
const Page: React.FC<{ theme: Theme; t: number; style?: React.CSSProperties }> = ({ theme, t, style }) => {
  const f = frameIndex(t);
  const macro = MACROS.find((m) => m.theme === theme && f >= Math.round(m.from * FPS) && f <= Math.round(m.to * FPS));
  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      <Img src={frameSrc(theme, t)} style={IMG} />
      {macro ? (
        <Img
          src={staticFile(`capture/macro/${macro.id}-${theme}/f${String(f).padStart(4, '0')}.jpg`)}
          style={{ position: 'absolute', left: macro.rect.x, top: macro.rect.y, width: macro.rect.w, height: macro.rect.h }}
        />
      ) : null}
    </div>
  );
};

/** The captured page, with the theme wipe growing out of the header toggle. */
export const Viewport: React.FC<{ t: number; children?: React.ReactNode }> = ({ t, children }) => {
  const th = themeAt(t);
  return (
    <div style={{ position: 'absolute', left: 0, top: BAR, width: VIEW.width, height: VIEW.height, overflow: 'hidden' }}>
      <Page theme={th.base} t={t} />
      {th.top ? (
        <Page theme={th.top} t={t} style={{ clipPath: `circle(${Math.max(0.1, th.p * MAX_R)}px at ${ORIGIN.x}px ${ORIGIN.y}px)` }} />
      ) : null}
      {children}
    </div>
  );
};

/**
 * Shallow depth of field for the close-ups: everything outside `focus` is softened and dimmed,
 * fading in with `k` (0–1).
 */
export const Focus: React.FC<{ focus: Rect; k: number; pad?: number }> = ({ focus, k, pad = 18 }) => {
  if (k <= 0.01) return null;
  const x0 = focus.x - pad;
  const y0 = focus.y - pad;
  const x1 = focus.x + focus.w + pad;
  const y1 = focus.y + focus.h + pad;
  const veil: React.CSSProperties = { position: 'absolute', backdropFilter: `blur(${5 * k}px) brightness(${1 - 0.3 * k})` };
  // Four panes around the focus rectangle.
  return (
    <>
      <div style={{ ...veil, left: 0, top: 0, width: VIEW.width, height: Math.max(0, y0) }} />
      <div style={{ ...veil, left: 0, top: y1, width: VIEW.width, height: Math.max(0, VIEW.height - y1) }} />
      <div style={{ ...veil, left: 0, top: y0, width: Math.max(0, x0), height: y1 - y0 }} />
      <div style={{ ...veil, left: x1, top: y0, width: Math.max(0, VIEW.width - x1), height: y1 - y0 }} />
    </>
  );
};

/** macOS-style window: traffic lights and the page title (no address bar, so no URL on screen). */
export const WindowChrome: React.FC<{ t: number }> = ({ t }) => {
  const th = themeAt(t);
  const bar = (theme: Theme, opacity: number) => {
    const c = THEME[theme];
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          height: BAR,
          background: c.bar,
          borderBottom: `1px solid ${c.barBorder}`,
          opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'absolute', left: 16, top: 13, display: 'flex', gap: 8 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((col) => (
            <div key={col} style={{ width: 12, height: 12, borderRadius: 6, background: col, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)' }} />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 24,
            padding: '0 14px',
            borderRadius: 7,
            background: c.pill,
            fontFamily: INTER,
            fontSize: 12.5,
            fontWeight: 500,
            color: c.title,
            letterSpacing: '-0.01em',
          }}
        >
          <LogoIcon size={14} />
          PromptZ - AI Prompt Engineering
        </div>
      </div>
    );
  };
  return (
    <>
      {bar(th.base, 1)}
      {th.top ? bar(th.top, th.p) : null}
    </>
  );
};

// ---- Overlays inside the viewport ---------------------------------------------------------

const C = TL.clicks;

/**
 * The native <select> pop-up (headless Chrome never paints it), drawn as the macOS menu in
 * dark appearance: rows at 30px, the current option ticked, highlight following the cursor.
 */
export const SelectMenu: React.FC<{ t: number }> = ({ t }) => {
  const open = C.select + 0.05;
  const close = C.selectPick + 0.16;
  if (t < open || t > close) return null;
  const s = rect('select');
  const rows = ['Match my request', 'Arabic', 'English'];
  const top = s.y + s.h + 8;
  const m = mouseAt(t);
  const hover = m ? Math.floor((m[1] - top - 5) / 30) : -1;
  // After the pick the chosen row blinks once, as macOS does, then the menu closes.
  const picked = t >= C.selectPick;
  const blink = picked && Math.floor((t - C.selectPick) * FPS) % 4 < 2;
  const inP = easeOut(clamp01((t - open) / 0.12));
  const outP = picked ? clamp01((t - C.selectPick - 0.08) / 0.08) : 0;
  return (
    <>
    <div
      style={{
        position: 'absolute',
        left: s.x,
        top,
        width: s.w * 0.55,
        padding: 5,
        borderRadius: 9,
        background: 'rgba(38, 37, 44, 0.97)',
        border: '0.5px solid rgba(255,255,255,0.14)',
        boxShadow: '0 18px 40px -8px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(0,0,0,0.6)',
        fontFamily: INTER,
        fontSize: 13,
        color: '#ECECEE',
        opacity: inP * (1 - outP),
        transform: `translateY(${(1 - inP) * -4}px)`,
      }}
    >
      {rows.map((label, i) => {
        const active = picked ? i === 2 && !blink : i === hover;
        return (
          <div
            key={label}
            style={{
              height: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              borderRadius: 5,
              background: active ? '#7C3AED' : 'transparent',
              color: active ? '#FFFFFF' : '#ECECEE',
            }}
          >
            <span style={{ width: 12, fontSize: 12, opacity: i === 0 && !picked ? 1 : 0 }}>✓</span>
            {label}
          </div>
        );
      })}
    </div>
    {/* The site's cursor sits under this overlay in the capture, so repaint it (hover ring, dark) on top. */}
    {m ? (
      <div
        style={{
          position: 'absolute',
          left: m[0] - 16,
          top: m[1] - 16,
          width: 32,
          height: 32,
          borderRadius: 16,
          border: '2px solid #9061F9',
          boxShadow: '0 0 12px rgba(124,58,237,0.35)',
          opacity: 1 - outP,
        }}
      />
    ) : null}
    </>
  );
};

const TL_CLICKS = META.clicks as { t: number; kind: string }[];

/** A soft ring where each click lands (the site's own cursor gives no press feedback). */
export const ClickRipples: React.FC<{ t: number }> = ({ t }) => (
  <>
    {TL_CLICKS.map((c, i) => {
      const k = (t - c.t) / 0.45;
      if (k < 0 || k > 1) return null;
      const m = mouseAt(c.t);
      if (!m) return null;
      const r = interpolate(easeOut(k), [0, 1], [6, 30]);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: m[0] - r,
            top: m[1] - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: '2px solid rgba(139, 92, 246, 0.9)',
            opacity: 1 - k,
          }}
        />
      );
    })}
  </>
);


export const WINDOW_RADIUS = 14;
export { WIN };
