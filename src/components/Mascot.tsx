import React from 'react';
import { Character } from './Character';
import { AppLang } from '../utils/i18n';

interface MascotProps {
  lang: AppLang;
}

/**
 * Mascot sitting directly on the top border frame of the Domain Context container.
 * Features:
 * - The "Explore" character holding the magnifying glass / search icon with animated discovery rays
 * - Sits firmly on the frame edge above Domain Context
 * - Positioned on the left in English (above "Domain Context"), on the right in Arabic (above "المجال التخصصي")
 * - Flipped to face inward towards the workspace controls
 */
export const Mascot: React.FC<MascotProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <div
      className={`absolute bottom-full z-20 pointer-events-none select-none transition-all duration-300 ${
        isAr ? 'right-4 sm:right-8 md:right-12' : 'left-4 sm:left-8 md:left-12'
      }`}
      style={{ marginBottom: '-8px' }}
      aria-hidden="true"
    >
      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 pointer-events-none select-none drop-shadow-md">
        <Character
          name="explore"
          instance="domain-context-mascot"
          flip={isAr}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};
