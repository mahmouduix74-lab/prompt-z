import React from 'react';
import { Character } from './Character';
import { AppLang } from '../utils/i18n';

interface MascotProps {
  lang: AppLang;
}

/**
 * Animated Mascot on the Prompt Console Frame
 * - Positioned on the left above the Domain Context frame
 * - Two-step smooth peekaboo animation:
 *   1) Peeks curiously with head and eyes above the edge
 *   2) Rises gracefully to reveal full upper body and magnifying glass
 *   3) Smoothly glides down and repeats
 */
export const Mascot: React.FC<MascotProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <div
      className={`absolute bottom-full z-20 pointer-events-none select-none pz-peeking-mascot ${
        isAr ? 'right-4 sm:right-6 md:right-8' : 'left-4 sm:left-6 md:left-8'
      }`}
      style={{ marginBottom: '-1px' }}
      aria-hidden="true"
    >
      <div
        className="pz-peeking-mascot__inner"
        style={{ width: '100px', height: '100px' }}
      >
        <Character
          name="explore"
          instance="domain-context-mascot"
          flip={isAr}
          className="w-full h-full drop-shadow-sm"
        />
      </div>
    </div>
  );
};

