import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, SAFE, Lang } from '../theme';
import { FONTS } from '../fonts';
import { pop } from '../anim';

/**
 * Big marketing headline pinned just below the Instagram top safe line.
 * Words rise in one after another; `highlight` words are purple.
 */
export const Caption: React.FC<{
  text: string;
  lang: Lang;
  delay?: number;
  highlight?: string[];
  top?: number;
  fontSize?: number;
}> = ({ text, lang, delay = 0, highlight = [], top = SAFE.top + 20, fontSize = 84 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // "\n" forces a line break; words keep one running index so the stagger flows across lines.
  const lines = text.split('\n').map((line) => line.split(' '));
  const starts = lines.map((_, li) => lines.slice(0, li).reduce((n, l) => n + l.length, 0));

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute',
        top,
        left: SAFE.side,
        right: SAFE.side,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: fontSize * 0.28,
        rowGap: 4,
        fontFamily: FONTS.display(lang),
        fontWeight: 700,
        fontSize,
        lineHeight: 1.15,
        letterSpacing: lang === 'ar' ? 0 : '-0.02em',
        color: C.ink,
        textAlign: 'center',
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: fontSize * 0.28, rowGap: 4, width: '100%' }}>
          {line.map((w, wi) => {
            const i = starts[li] + wi;
            const p = pop(frame, fps, delay + i * 3);
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
                  color: highlight.some((h) => w.includes(h)) ? C.purple : C.ink,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
