import React, { useEffect, useRef, useState } from 'react';

/**
 * A tiny brand-purple dot on the tip of the normal mouse cursor, moving with it on every mouse
 * event (no easing, so it never trails behind). The system cursor stays as it is, and nothing is
 * shown on touch devices (pointer: coarse).
 */
const DOT_SIZE = 8;

export const CustomCursor: React.FC = () => {
  const [hasPointer, setHasPointer] = useState(false);
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const update = () => setHasPointer(fine.matches);
    update();
    fine.addEventListener('change', update);
    return () => fine.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!hasPointer) return;
    const dot = dotRef.current;
    if (!dot) return;

    // pointerrawupdate reports every hardware sample where supported; mousemove elsewhere.
    const event = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'mousemove';
    const onMove = (e: Event) => {
      const { clientX, clientY } = e as MouseEvent;
      dot.style.transform = `translate3d(${clientX - DOT_SIZE / 2}px, ${clientY - DOT_SIZE / 2}px, 0)`;
      dot.style.opacity = '1';
    };
    const onLeave = () => {
      dot.style.opacity = '0';
    };

    window.addEventListener(event, onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener(event, onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [hasPointer]);

  if (!hasPointer) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[99999] rounded-full bg-[#7132F5] opacity-0 transition-opacity duration-200 will-change-transform dark:bg-[#9061F9]"
      style={{ width: DOT_SIZE, height: DOT_SIZE }}
    />
  );
};
