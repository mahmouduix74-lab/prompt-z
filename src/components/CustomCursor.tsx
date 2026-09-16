import React, { useEffect, useRef, useState } from 'react';
import { Character } from './Character';

/**
 * CustomCursor handles:
 * 1) Small solid dot (10px, brand purple #7C3AED / #7638F5) tightly following cursor with no lag.
 * 2) Smooth expansion into hollow ring (32px, purple border, transparent center) on hovering interactive targets.
 * 3) Companion "Create" character (body only, no bulb/rays, 36px) floating beside the cursor with smooth lerp easing.
 * 4) Respects touch devices (pointer: coarse) - renders nothing and restores default cursor.
 * 5) Respects prefers-reduced-motion: keeps cursor dot/ring but disables companion trailing loop.
 */
export const CustomCursor: React.FC = () => {
  const [hasPointer, setHasPointer] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Direct mouse positions
  const mousePos = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
  // Lerp companion positions
  const companionPos = useRef<{ x: number; y: number }>({ x: -100, y: -100 });

  // DOM elements for direct transform updates (60+ FPS without React re-renders)
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const companionRef = useRef<HTMLDivElement | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Detect if device has a fine pointer (real mouse / trackpad, not touch)
    const mediaQueryPointer = window.matchMedia('(pointer: fine)');
    const mediaQueryMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updatePointerStatus = () => {
      setHasPointer(mediaQueryPointer.matches);
    };

    const updateMotionStatus = () => {
      setPrefersReducedMotion(mediaQueryMotion.matches);
    };

    updatePointerStatus();
    updateMotionStatus();

    mediaQueryPointer.addEventListener('change', updatePointerStatus);
    mediaQueryMotion.addEventListener('change', updateMotionStatus);

    return () => {
      mediaQueryPointer.removeEventListener('change', updatePointerStatus);
      mediaQueryMotion.removeEventListener('change', updateMotionStatus);
    };
  }, []);

  // Set up mouse tracking and animation loop
  // Ref guards to avoid redundant React state updates on mouse move
  const isHoveredRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    if (!hasPointer) return;

    // Add class to documentElement to hide default cursor across all elements
    document.documentElement.classList.add('has-custom-cursor');

    const handleMouseMove = (e: MouseEvent) => {
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
        // Initialize companion at mouse position on first entrance
        companionPos.current = { x: e.clientX, y: e.clientY };
      }

      mousePos.current = { x: e.clientX, y: e.clientY };

      // Immediately position the primary cursor dot with no lag
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check if target or any ancestor is an interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest('button, a, input, textarea, select, [role="button"], [tabindex="0"], label, summary, .cursor-pointer')
        );
        if (isHoveredRef.current !== isInteractive) {
          isHoveredRef.current = isInteractive;
          setIsHovered(isInteractive);
        }
      }
    };

    const handleMouseLeave = () => {
      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        setIsVisible(false);
      }
    };

    const handleMouseEnter = () => {
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // RAF loop for companion character lerping
    const renderLoop = () => {
      if (companionRef.current) {
        if (prefersReducedMotion) {
          // No trailing lag in reduced motion mode, snap alongside cursor
          companionPos.current.x = mousePos.current.x;
          companionPos.current.y = mousePos.current.y;
        } else {
          // Smooth trailing easing (lerp factor: 0.14)
          const targetX = mousePos.current.x;
          const targetY = mousePos.current.y;

          companionPos.current.x += (targetX - companionPos.current.x) * 0.14;
          companionPos.current.y += (targetY - companionPos.current.y) * 0.14;
        }

        // Offset companion by +16px horizontally and +4px vertically so the body floats beside cursor
        const compX = companionPos.current.x + 16;
        const compY = companionPos.current.y + 4;
        companionRef.current.style.transform = `translate3d(${compX}px, ${compY}px, 0)`;
      }

      rafId.current = requestAnimationFrame(renderLoop);
    };

    rafId.current = requestAnimationFrame(renderLoop);

    return () => {
      document.documentElement.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [hasPointer, isVisible, prefersReducedMotion]);

  if (!hasPointer) {
    return null;
  }

  return (
    <>
      {/* 1. Primary Custom Cursor (10px dot or 32px hollow ring on hover) */}
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none z-[99999] will-change-transform"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        <div
          className={`-translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ease-out ${
            isHovered
              ? 'w-8 h-8 border-2 border-[#7C3AED] dark:border-[#9061F9] bg-transparent shadow-[0_0_12px_rgba(124,58,237,0.35)]'
              : 'w-2.5 h-2.5 bg-[#7C3AED] dark:bg-[#9061F9] shadow-[0_0_8px_rgba(124,58,237,0.45)]'
          }`}
        />
      </div>

      {/* 2. Companion Character (Create mascot body-only, no bulb, no rays, trailing slightly) */}
      {!prefersReducedMotion && (
        <div
          ref={companionRef}
          aria-hidden="true"
          className="fixed top-0 left-0 pointer-events-none z-[99998] will-change-transform select-none"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        >
          {/* Sized roughly 36px, no label, no box, no shadow */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <Character
              name="create"
              instance="cursor-companion"
              bodyOnly={true}
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
};
