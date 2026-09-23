import React from 'react';

// Brand colors from the site's icon (public/promptz-icon.svg).
const PURPLE = '#7132F5';
const LILAC = '#D3B8FE';
const INK = '#1E1928';

/** The site's app icon (public/promptz-icon.svg), inlined so it renders crisply at any size. */
export const LogoIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
    <rect width="128" height="128" rx="36" fill={PURPLE} />
    <line x1="84" y1="30" x2="90" y2="44" stroke={LILAC} strokeWidth="6.5" strokeLinecap="round" />
    <line x1="89" y1="52" x2="105" y2="42" stroke={LILAC} strokeWidth="6.5" strokeLinecap="round" />
    <line x1="95" y1="67" x2="110" y2="62" stroke={LILAC} strokeWidth="6.5" strokeLinecap="round" />
    <path
      d="M 8 88 C 19 76, 36 54, 57 48 C 73 43, 82 54, 81 74 C 80 92, 73 112, 71 128 L 8 128 Z"
      fill="#FFFFFF"
      stroke={INK}
      strokeWidth="4.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <ellipse cx="54" cy="83" rx="3.6" ry="7.2" transform="rotate(-16 54 83)" fill={INK} />
    <ellipse cx="68" cy="85" rx="3.6" ry="7.2" transform="rotate(-16 68 85)" fill={INK} />
  </svg>
);
