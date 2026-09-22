import React from 'react';
import { C } from '../theme';
import { FONTS } from '../fonts';

/** The site's app icon (public/promptz-icon.svg), inlined so it renders crisply at any size. */
export const LogoIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="36" fill={C.purpleBrand} />
    <line x1="84" y1="30" x2="90" y2="44" stroke={C.lilac} strokeWidth="6.5" strokeLinecap="round" />
    <line x1="89" y1="52" x2="105" y2="42" stroke={C.lilac} strokeWidth="6.5" strokeLinecap="round" />
    <line x1="95" y1="67" x2="110" y2="62" stroke={C.lilac} strokeWidth="6.5" strokeLinecap="round" />
    <path
      d="M 8 88 C 19 76, 36 54, 57 48 C 73 43, 82 54, 81 74 C 80 92, 73 112, 71 128 L 8 128 Z"
      fill="#FFFFFF"
      stroke={C.logoInk}
      strokeWidth="4.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <ellipse cx="54" cy="83" rx="3.6" ry="7.2" transform="rotate(-16 54 83)" fill={C.logoInk} />
    <ellipse cx="68" cy="85" rx="3.6" ry="7.2" transform="rotate(-16 68 85)" fill={C.logoInk} />
  </svg>
);

/** "PromptZ" wordmark: always Latin and left-to-right, even in the Arabic video. */
export const Wordmark: React.FC<{ fontSize: number }> = ({ fontSize }) => (
  <span
    dir="ltr"
    style={{
      fontFamily: FONTS.wordmark,
      fontWeight: 800,
      fontSize,
      letterSpacing: '-0.025em',
      color: C.ink,
      lineHeight: 1,
    }}
  >
    Prompt<span style={{ color: C.purpleBrand }}>Z</span>
  </span>
);

export const LogoLockup: React.FC<{ iconSize: number; fontSize: number; gap?: number }> = ({ iconSize, fontSize, gap = 20 }) => (
  <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap }}>
    <LogoIcon size={iconSize} />
    <Wordmark fontSize={fontSize} />
  </div>
);
