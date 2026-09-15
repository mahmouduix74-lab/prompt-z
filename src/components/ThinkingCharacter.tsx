import React from 'react';
import { motion } from 'motion/react';

interface ThinkingCharacterProps {
  className?: string;
  size?: number; // size in px, default 96
  label?: string;
  sublabel?: string;
  lang?: 'en' | 'ar';
  flip?: boolean;
}

export const ThinkingCharacter: React.FC<ThinkingCharacterProps> = ({
  className = '',
  size = 110,
  label,
  sublabel,
  lang,
  flip = false,
}) => {
  const isFlipped = flip || lang === 'ar';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Animated Reading & Thinking Character */}
      <motion.div
        animate={{
          y: [0, -6, 0],
          rotate: [0, 1.5, -1, 0],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          transform: isFlipped ? 'scaleX(-1)' : undefined,
        }}
      >
        {/* Soft Ambient Glow under character */}
        <div className="absolute inset-0 bg-purple-500/15 dark:bg-purple-500/25 blur-xl rounded-full" />

        <svg
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-sm"
          aria-hidden="true"
        >
          {/* Character Body White Fill (for high visibility in dark & light mode) */}
          <path
            d="M 32 210 C 35 170 38 150 42 128 C 48 94 68 68 102 72 C 122 75 132 88 135 112 C 135 140 120 180 118 206 C 85 212 50 212 32 210 Z"
            fill="#FFFFFF"
          />

          {/* Document being read - with slight floating motion */}
          <g transform="rotate(7 165 110)">
            <rect
              x="110"
              y="40"
              width="106"
              height="138"
              rx="16"
              fill="#EDE5FD"
              stroke="#D8C7FB"
              strokeWidth="2"
            />
            {/* Document Lines (simulating prompt / thinking content) */}
            <rect x="135" y="70" width="55" height="8" rx="4" fill="#9F77F8" />
            <rect x="132" y="94" width="52" height="8" rx="4" fill="#9F77F8" />
            <rect x="130" y="118" width="46" height="8" rx="4" fill="#9F77F8" />
          </g>

          {/* Character Head / Body Outline */}
          <path
            d="M 32 210 C 35 170 38 150 42 128 C 48 94 68 68 102 72 C 122 75 132 88 135 112"
            stroke="#1E1928"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Focused Oval Eyes reading the document */}
          <ellipse cx="85" cy="110" rx="4.2" ry="9" fill="#1E1928" />
          <ellipse cx="102" cy="108" rx="4.2" ry="9" fill="#1E1928" />

          {/* Left Arm holding the document */}
          <path
            d="M 80 178 C 110 155 145 136 158 152 C 165 162 158 185 118 206"
            stroke="#1E1928"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="#FFFFFF"
          />

          {/* Right Arm holding the document on right side */}
          <path
            d="M 216 122 C 228 135 234 165 204 186 C 188 197 184 200 184 200"
            stroke="#1E1928"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </motion.div>

      {/* Optional Label & Sublabel */}
      {(label || sublabel) && (
        <div className="mt-3 flex flex-col items-center text-center max-w-xs">
          {label && (
            <motion.p
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200"
            >
              {label}
            </motion.p>
          )}
          {sublabel && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
