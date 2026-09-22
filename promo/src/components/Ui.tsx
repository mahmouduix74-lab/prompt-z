import React from 'react';
import { C, RADIUS, SHADOW, Lang } from '../theme';
import { FONTS } from '../fonts';

/** Frosted white card, the site's console frame (rounded-3xl, white/80, zinc border). */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; lang: Lang }> = ({ children, style, lang }) => (
  <div
    dir={lang === 'ar' ? 'rtl' : 'ltr'}
    style={{
      backgroundColor: C.surfaceSoft,
      border: `2px solid ${C.border}`,
      borderRadius: RADIUS.card,
      boxShadow: SHADOW.card,
      backdropFilter: 'blur(24px)',
      fontFamily: FONTS.body(lang),
      color: C.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Domain chip. Selected = solid purple with white text, as in DomainSelector. */
export const Chip: React.FC<{ label: string; selected?: boolean; lang: Lang; fontSize?: number; style?: React.CSSProperties }> = ({
  label,
  selected = false,
  lang,
  fontSize = 30,
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${fontSize * 0.45}px ${fontSize * 0.85}px`,
      borderRadius: RADIUS.chip,
      fontFamily: FONTS.body(lang),
      fontWeight: 600,
      fontSize,
      whiteSpace: 'nowrap',
      color: selected ? '#FFFFFF' : C.inkSoft,
      backgroundColor: selected ? C.purple : C.surface,
      border: `2px solid ${selected ? C.purple : C.borderStrong}`,
      boxShadow: selected ? SHADOW.glow : SHADOW.soft,
      ...style,
    }}
  >
    {label}
  </div>
);

/** Solid purple call-to-action, like the site's Generate button. */
export const PrimaryButton: React.FC<{ label: string; lang: Lang; fontSize?: number; icon?: React.ReactNode; style?: React.CSSProperties }> = ({
  label,
  lang,
  fontSize = 36,
  icon,
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: fontSize * 0.4,
      padding: `${fontSize * 0.6}px ${fontSize * 1.1}px`,
      borderRadius: RADIUS.button,
      backgroundColor: C.purple,
      color: '#FFFFFF',
      fontFamily: FONTS.body(lang),
      fontWeight: 700,
      fontSize,
      whiteSpace: 'nowrap',
      boxShadow: SHADOW.glow,
      ...style,
    }}
  >
    {icon}
    {label}
  </div>
);

/** Sparkle/magic wand glyph used on the Generate button (lucide Wand2 path). */
export const WandIcon: React.FC<{ size: number; color?: string }> = ({ size, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
    <path d="m14 7 3 3" />
    <path d="M5 6v4" />
    <path d="M19 14v4" />
    <path d="M10 2v2" />
    <path d="M7 8H3" />
    <path d="M21 16h-4" />
    <path d="M11 3H9" />
  </svg>
);

/** A finger-tap indicator: a ring that shrinks onto the target then ripples out. `t` goes 0 → 1. */
export const Tap: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  if (t <= 0 || t >= 1) return null;
  const press = t < 0.4 ? t / 0.4 : 1;
  const ripple = t < 0.4 ? 0 : (t - 0.4) / 0.6;
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          width: 90,
          height: 90,
          left: -45,
          top: -45,
          borderRadius: 45,
          backgroundColor: 'rgba(24,24,27,0.18)',
          border: '3px solid rgba(255,255,255,0.9)',
          transform: `scale(${1.3 - press * 0.45})`,
          opacity: 1 - ripple,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 90,
          height: 90,
          left: -45,
          top: -45,
          borderRadius: 45,
          border: `4px solid ${C.purple}`,
          transform: `scale(${1 + ripple * 1.6})`,
          opacity: ripple > 0 ? 1 - ripple : 0,
        }}
      />
    </div>
  );
};
