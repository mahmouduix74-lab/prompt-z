import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../theme';

// Soft purple glows drifting slowly, matching the site hero. Global frame keeps it continuous across scenes.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const blob = (x: number, y: number, size: number, color: string, phase: number) => ({
    position: 'absolute' as const,
    left: x + Math.sin(t * 0.6 + phase) * 60,
    top: y + Math.cos(t * 0.5 + phase) * 80,
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    filter: 'blur(120px)',
  });
  // Deterministic scatter (a fixed hash, never Math.random, so every render is identical).
  const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const dots = Array.from({ length: 22 }, (_, i) => ({
    x: hash(i) * 1080,
    y: hash(i + 100) * 1920,
    o: 0.12 + hash(i + 200) * 0.25,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <div style={blob(-220, 180, 820, 'rgba(147, 51, 234, 0.30)', 0)} />
      <div style={blob(520, 820, 760, 'rgba(124, 58, 237, 0.26)', 2)} />
      <div style={blob(-120, 1380, 700, 'rgba(167, 139, 250, 0.30)', 4)} />
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: (((d.y - interpolate(frame, [0, 600], [0, 120])) % 1920) + 1920) % 1920,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: C.purple,
            opacity: d.o,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
