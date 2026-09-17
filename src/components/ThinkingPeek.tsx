import React from 'react';
import { Character } from './Character';
import { AppLang } from '../utils/i18n';
import '../styles/characters.css';

interface ThinkingPeekProps {
  lang: AppLang;
}

/**
 * The "thinking" character, peeking above the raw-prompt input frame on a
 * loop. It sits on the reading-direction side: right for Arabic, left for
 * English — and faces that same side (the artwork's own laptop/focus side
 * reads right by default, so English mirrors it to face left instead).
 *
 * Purely decorative: aria-hidden (via Character) and pointer-events: none
 * (via the .pz-thinking-peek CSS), so it never affects layout or input.
 */
export const ThinkingPeek: React.FC<ThinkingPeekProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <div className={`pz-thinking-peek ${isAr ? 'pz-thinking-peek--rtl' : 'pz-thinking-peek--ltr'}`}>
      <Character name="thinking" flip={!isAr} />
    </div>
  );
};
