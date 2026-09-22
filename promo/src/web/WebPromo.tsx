import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { cameraAt } from './camera';
import { INTER } from './fonts';
import { OUTRO_CLICK, Outro } from './Outro';
import { ClickRipples, SelectMenu, Stage, THEME, Viewport, WindowChrome, themeAt } from './parts';
import { FPS, META, REVEALS, STAGE, TL, VO, WIN, clamp01, easeInOut, easeOut } from './timing';

/*
 * PromptZ web promo, 16:9, 25 s.
 * The page itself is the real site captured frame by frame (capture/capture.mjs) in light and
 * dark; this composition frames it in a browser window, moves the camera, wipes between the
 * themes from the header toggle, and adds the voice-over, music, captions and the end card.
 */

const OUTRO = TL.outro.start;
const f = (s: number) => Math.round(s * FPS);

// Lines spoken while the action sits at the bottom of the frame (Generate button, the result's
// last lines) are captioned at the top instead.
const TOP_LINES = new Set(['l5', 'l7']);

/** Voice-over captions, one line at a time, for sound-off viewing. The end card speaks for itself. */
const Captions: React.FC<{ t: number }> = ({ t }) => {
  const line = VO.find((l) => l.id !== 'l8' && t >= l.at - 0.05 && t <= l.at + l.dur + 0.3);
  if (!line) return null;
  const p = Math.min(clamp01((t - line.at + 0.05) / 0.15), clamp01((line.at + line.dur + 0.3 - t) / 0.15));
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(TOP_LINES.has(line.id) ? { top: 34 } : { bottom: 34 }),
        display: 'flex',
        justifyContent: 'center',
        opacity: p,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          padding: '12px 26px',
          borderRadius: 16,
          background: 'rgba(16, 12, 24, 0.74)',
          backdropFilter: 'blur(12px)',
          color: '#FFFFFF',
          fontFamily: INTER,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: '-0.01em',
          textAlign: 'center',
          transform: `translateY(${(1 - p) * 8}px)`,
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

/** Music ducks under the voice-over. (Remotion caps volume at 1; `npm run render:web` adds +4.3 dB after the render.) */
const musicVolume = (frame: number) => {
  const t = frame / FPS;
  const inVo = VO.reduce((m, l) => Math.max(m, Math.min(clamp01((t - l.at + 0.25) / 0.25), clamp01((l.at + l.dur + 0.3 - t) / 0.3))), 0);
  return interpolate(inVo, [0, 1], [0.34, 0.15]);
};

export const WebPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = cameraAt(t);

  // Window entrance and exit around the camera.
  const intro = easeOut(clamp01(t / 0.9));
  const out = easeInOut(clamp01((t - (OUTRO - 0.15)) / 0.7));
  const z = cam.z * (0.94 + 0.06 * intro) * (1 - 0.18 * out);
  const x = STAGE.width / 2 - cam.cx * z;
  const y = STAGE.height / 2 - cam.cy * z + (1 - intro) * 90 - out * 70;
  const th = themeAt(t);
  const shadow = THEME[th.top && th.p > 0.5 ? th.top : th.base];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Stage t={t} />

      {t < OUTRO + 0.6 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: WIN.width,
            height: WIN.height,
            transformOrigin: '0 0',
            transform: `translate(${x}px, ${y}px) scale(${z})`,
            opacity: intro * (1 - out),
            filter: out > 0 ? `blur(${out * 8}px)` : undefined,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: `${shadow.shadow}, 0 0 0 1px ${shadow.frame}`,
          }}
        >
          <WindowChrome t={t} />
          <Viewport t={t}>
            <SelectMenu t={t} />
            <ClickRipples t={t} />
          </Viewport>
        </div>
      ) : null}

      <Outro t={t} />
      <Captions t={t} />

      {/* ---- Sound ---- */}
      <Audio src={staticFile('audio/music.mp3')} volume={musicVolume} />
      {VO.map((l) => (
        <Sequence key={l.id} from={f(l.at)} durationInFrames={f(l.dur) + 6}>
          <Audio src={staticFile(`vo/${l.id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {[...META.clicks.map((c) => c.t), OUTRO_CLICK].map((at, i) => (
        <Sequence key={`c${i}`} from={f(at)} durationInFrames={6}>
          <Audio src={staticFile('audio/click.wav')} volume={0.32} />
        </Sequence>
      ))}
      {REVEALS.map((r) => (
        <Sequence key={`w${r.at}`} from={f(r.at) - 3} durationInFrames={30}>
          <Audio src={staticFile('audio/whoosh.wav')} volume={0.26} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
