import React, { useEffect, useRef } from 'react';
import { Character } from './Character';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import '../styles/characters.css';

interface MascotProps {
  paused: boolean;
  onTogglePaused: () => void;
  lang: AppLang;
}

// The travel path starts after the pause button (16px + 32px + 12px) and ends 16px from the edge.
const PATH_START = 60;
const PATH_END_GAP = 16;

/**
 * Main character: fixed at the bottom of the screen, hopping, and travelling
 * across the page in the reading direction as the user scrolls.
 */
export const Mascot: React.FC<MascotProps> = ({ paused, onTogglePaused, lang }) => {
  const t = UI_STRINGS[lang];
  const travelRef = useRef<HTMLDivElement>(null);
  const facingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const travel = travelRef.current;
    const facing = facingRef.current;
    if (!travel || !facing) return;

    let frame = 0;
    let lastY = window.scrollY;
    // Read the direction from the prop rather than <html dir>: App sets that
    // attribute in its own effect, which can run after this one.
    const rtl = lang === 'ar';

    // The drawing faces right; start facing the reading direction.
    facing.style.transform = `scaleX(${rtl ? -1 : 1})`;

    const place = () => {
      frame = 0;
      const size = travel.offsetWidth;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      const range = Math.max(0, window.innerWidth - size - PATH_START - PATH_END_GAP);
      const x = rtl ? PATH_START + (1 - progress) * range : PATH_START + progress * range;
      travel.style.transform = `translateX(${Math.round(x)}px)`;

      if (window.scrollY !== lastY) {
        const forward = window.scrollY > lastY;
        const facesRight = rtl ? !forward : forward;
        facing.style.transform = `scaleX(${facesRight ? 1 : -1})`;
        lastY = window.scrollY;
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const onScroll = () => {
      if (!paused) schedule();
    };

    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule); // keep it on screen even while paused

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [paused, lang]);

  return (
    <>
      <div ref={travelRef} className="pz-mascot" aria-hidden="true">
        <div ref={facingRef} className="pz-mascot__facing">
          <div className="pz-mascot__body">
            <Character name="create" instance="mascot" />
          </div>
        </div>
      </div>

      {/* Pauses every character animation on the page (WCAG 2.2.2) */}
      <button type="button" className="pz-motion-toggle" aria-pressed={paused} onClick={onTogglePaused}>
        {paused ? (
          <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M4 2.6v8.8a.6.6 0 0 0 .92.5l6.9-4.4a.6.6 0 0 0 0-1L4.92 2.1A.6.6 0 0 0 4 2.6Z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        )}
        <span className="sr-only">{t.pauseCharacters}</span>
      </button>
    </>
  );
};
