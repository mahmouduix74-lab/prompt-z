import React from 'react';
import { Character } from './Character';
import { AppLang } from '../utils/i18n';
import '../styles/characters.css';

interface MascotProps {
  lang: AppLang;
}

/**
 * Peeking Mascot: The "Create" character fixed to the top edge of the main prompt console frame.
 * Positioned on the left if English (lang === 'en') and on the right if Arabic (lang === 'ar').
 * Sits on the frame's top border so only its head/top portion is visible at rest, with a peekaboo loop.
 */
export const Mascot: React.FC<MascotProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <div
      className={`absolute bottom-full z-20 pointer-events-none ${
        isAr ? 'right-4 sm:right-8' : 'left-4 sm:left-8'
      }`}
      style={{ marginBottom: '-1px' }}
    >
      {/* The Peeking Mascot: Clipped at the console frame's top edge */}
      <div
        className="pz-peeking-mascot overflow-hidden w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 pointer-events-none select-none drop-shadow-xs"
        aria-hidden="true"
      >
        <div className="pz-peeking-mascot__inner w-full h-full">
          <Character name="create" instance="peeking-mascot" />
        </div>
      </div>
    </div>
  );
};

