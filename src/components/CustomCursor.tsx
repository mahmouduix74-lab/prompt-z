import React, { useEffect, useRef, useState } from 'react';

/**
 * CustomCursor provides a refined, responsive cursor:
 * 1) Small precision dot (10px, brand purple #7132F5 / #7638F5) tightly following cursor with no lag.
 * 2) Smooth expansion into hollow ring (32px, purple border, transparent center) on hovering interactive targets.
 * 3) Respects touch devices (pointer: coarse) - renders nothing and restores default cursor.
 */
export const CustomCursor: React.FC = () => {
  const [hasPointer, setHasPointer] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // DOM element for direct transform updates (60+ FPS without React re-renders)
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Detect if device has a fine pointer (real mouse / trackpad, not touch)
    const mediaQueryPointer = window.matchMedia('(pointer: fine)');

    const updatePointerStatus = () => {
      setHasPointer(mediaQueryPointer.matches);
    };

    updatePointerStatus();
    mediaQueryPointer.addEventListener('change', updatePointerStatus);

    return () => {
      mediaQueryPointer.removeEventListener('change', updatePointerStatus);
    };
  }, []);

  // Set up mouse tracking
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
      }

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

    return () => {
      document.documentElement.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [hasPointer]);

  if (!hasPointer) {
    return null;
  }

  return (
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
            ? 'w-8 h-8 border-2 border-[#7132F5] dark:border-[#9061F9] bg-transparent shadow-[0_0_12px_rgba(113,50,245,0.35)]'
            : 'w-2.5 h-2.5 bg-[#7132F5] dark:bg-[#9061F9] shadow-[0_0_8px_rgba(113,50,245,0.45)]'
        }`}
      />
    </div>
  );
};
