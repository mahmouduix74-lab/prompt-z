import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  lang?: 'ar' | 'en';
  showWordmark?: boolean;
  /** Display classes for the wordmark, e.g. to hide it on the narrowest screens. */
  wordmarkClassName?: string;
}

/**
 * PromptZ Mascot Icon:
 * The signature purple squircle mascot featuring the curious white spark character
 * with radiating inspiration rays.
 */
export const PromptZIcon: React.FC<{
  className?: string;
  sizeClass?: string;
}> = ({ className = '', sizeClass = 'w-8 h-8' }) => {
  return (
    <div
      className={`relative ${sizeClass} shrink-0 inline-flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${className}`}
    >
      <svg
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(113,50,245,0.35)]"
        aria-hidden="true"
      >
        {/* Rounded Purple Squircle Background */}
        <rect width="128" height="128" rx="34" fill="#7132F5" />

        {/* Radiating Spark Rays */}
        <line
          x1="84"
          y1="30"
          x2="90"
          y2="44"
          stroke="#D4BAFE"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <line
          x1="89"
          y1="52"
          x2="105"
          y2="42"
          stroke="#D4BAFE"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <line
          x1="95"
          y1="67"
          x2="110"
          y2="62"
          stroke="#D4BAFE"
          strokeWidth="6.5"
          strokeLinecap="round"
        />

        {/* Cute PromptZ White Creature Mascot */}
        <path
          d="M 8 88 C 19 76, 36 54, 57 48 C 73 43, 82 54, 81 74 C 80 92, 73 112, 71 128 L 8 128 Z"
          fill="#FFFFFF"
          stroke="#1E1928"
          strokeWidth="4.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Oval Eyes */}
        <ellipse
          cx="54"
          cy="83"
          rx="3.6"
          ry="7.2"
          transform="rotate(-16 54 83)"
          fill="#1E1928"
        />
        <ellipse
          cx="68"
          cy="85"
          rx="3.6"
          ry="7.2"
          transform="rotate(-16 68 85)"
          fill="#1E1928"
        />
      </svg>
    </div>
  );
};

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'sm',
  showBadge = false,
  showWordmark = true,
  wordmarkClassName = 'flex',
}) => {
  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    xs: 'text-sm',
    sm: 'text-[21px] sm:text-[23px]',
    md: 'text-[25px] sm:text-[27px]',
    lg: 'text-[29px] sm:text-[32px]',
    xl: 'text-[36px] sm:text-[40px]',
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Signature PromptZ Icon (Slightly larger, crisp) */}
      <PromptZIcon sizeClass={iconSizes[size]} />

      {/* PromptZ Wordmark - Rendered with exact Montserrat 800 letterforms matching the logo */}
      {showWordmark && (
        <div className={`${wordmarkClassName} items-center leading-none`}>
          <span
            className={`font-[800] tracking-[-0.025em] text-[#181622] dark:text-white ${textSizes[size]}`}
            style={{
              fontFamily: "'Montserrat', system-ui, -apple-system, sans-serif",
            }}
          >
            Prompt<span className="text-[#7132F5] dark:text-[#8B5CF6]">Z</span>
          </span>
          {showBadge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 ms-1.5">
              AI
            </span>
          )}
        </div>
      )}
    </div>
  );
};
