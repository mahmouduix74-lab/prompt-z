import React, { useEffect, useRef, useState } from 'react';

/**
 * A tiny brand-purple dot that follows the normal mouse cursor with a slight, smooth lag.
 * The system cursor stays as it is. Nothing is shown on touch devices (pointer: coarse), and with
 * reduced motion the dot sits on the cursor without the lag.
 */
const DOT_SIZE = 8;
/** How much of the remaining distance the dot covers each frame (1 = no lag). */
const FOLLOW = 0.22;

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
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = { x: -100, y: -100 };
    const at = { x: -100, y: -100 };
    let frame = 0;

    const draw = () => {
      at.x += (target.x - at.x) * (still ? 1 : FOLLOW);
      at.y += (target.y - at.y) * (still ? 1 : FOLLOW);
      dot.style.transform = `translate3d(${at.x - DOT_SIZE / 2}px, ${at.y - DOT_SIZE / 2}px, 0)`;
      // Keep animating only while the dot is still catching up.
      frame = Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 0.1 ? requestAnimationFrame(draw) : 0;
    };
    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (at.x < 0) {
        at.x = target.x;
        at.y = target.y;
      }
      dot.style.opacity = '1';
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onLeave = () => {
      dot.style.opacity = '0';
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
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
