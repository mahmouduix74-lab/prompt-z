import React from 'react';
import { INTER } from './fonts';
import { TL, clamp01, easeOut } from './timing';

/**
 * Numbered feature title, top-left, for each part of the tour ("03 — Domain Context").
 * Slides in with a blur, carries a hairline that fills over the section, and fades out.
 */
export const FeatureTitle: React.FC<{ t: number }> = ({ t }) => {
  const i = TL.features.findIndex((f) => t >= f.at && t < f.to);
  if (i < 0) return null;
  const f = TL.features[i];
  const inP = easeOut(clamp01((t - f.at) / 0.35));
  const outP = clamp01((t - (f.to - 0.2)) / 0.2);
  const progress = clamp01((t - f.at) / (f.to - f.at));
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        top: 40,
        opacity: inP * (1 - outP),
        transform: `translateX(${(1 - inP) * -24}px)`,
        filter: `blur(${(1 - inP) * 6}px)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 20px 13px 16px',
          borderRadius: 14,
          background: 'rgba(12, 10, 18, 0.62)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 16px 40px -14px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          fontFamily: INTER,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: '#A78BFA', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {String(i + 1).padStart(2, '0')}
        </span>
        <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)' }} />
        <span style={{ fontSize: 22, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{f.title}</span>
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 2,
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #7C3AED, #C084FC)',
          }}
        />
      </div>
    </div>
  );
};
