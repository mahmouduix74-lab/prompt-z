import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CUTS, cameraAt, sinceCut } from './camera';
import { INTER } from './fonts';
import { FeatureTitle } from './FeatureTitle';
import { OUTRO_CLICK, Outro } from './Outro';
import { ClickRipples, DownloadChip, Focus, SelectMenu, Stage, THEME, Viewport, WindowChrome, themeAt } from './parts';
import { FPS, META, REVEALS, STAGE, TL, VO, WIN, clamp01, easeInOut, easeOutExpo, rect } from './timing';

/*
 * PromptZ web promo, 16:9, 32 s.
 * The page itself is the real site captured frame by frame (capture/capture.mjs) in light and
 * dark, with 4× passes for the close-ups; this composition frames it in a browser window, runs
 * the shot list (camera.ts), wipes between the themes, and adds the
 * voice-over, music, sound design, captions and the end card.
 */

const OUTRO = TL.outro.start;
const f = (s: number) => Math.round(s * FPS);

/** Voice-over captions, one line at a time, for sound-off viewing. The end card speaks for itself. */
const Captions: React.FC<{ t: number }> = ({ t }) => {
  const line = VO.find((l) => l.id !== VO[VO.length - 1].id && t >= l.at - 0.05 && t <= l.at + l.dur + 0.25);
  if (!line) return null;
  const p = Math.min(clamp01((t - line.at + 0.05) / 0.15), clamp01((line.at + line.dur + 0.25 - t) / 0.15));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30, display: 'flex', justifyContent: 'center', opacity: p }}>
      <div
        style={{
          padding: '8px 18px',
          borderRadius: 12,
          background: 'rgba(12, 10, 18, 0.62)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.96)',
          fontFamily: INTER,
          fontWeight: 500,
          fontSize: 23,
          letterSpacing: '-0.005em',
          transform: `translateY(${(1 - p) * 6}px)`,
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

/** Music ducks under the voice-over. (Remotion caps volume at 1; `npm run render` adds +3.5 dB after the render.) */
const musicVolume = (frame: number) => {
  const t = frame / FPS;
  const inVo = VO.reduce((m, l) => Math.max(m, Math.min(clamp01((t - l.at + 0.25) / 0.25), clamp01((l.at + l.dur + 0.3 - t) / 0.3))), 0);
  return interpolate(inVo, [0, 1], [0.36, 0.16]);
};

// Close-ups keep their subject sharp and soften the rest of the page.
const [, , CUT_DEPTH, CUT_TYPING] = TL.cuts;
const FOCI = [
  { rect: rect('chips'), from: TL.scroll.end + 0.1, to: CUT_DEPTH },
  { rect: rect('depth'), from: CUT_DEPTH, to: CUT_TYPING },
  { rect: rect('inputPanel'), from: CUT_TYPING, to: TL.typing.end + 0.25 },
];
const focusAt = (t: number) => {
  const f = FOCI.find((x) => t >= x.from && t < x.to);
  if (!f) return null;
  // Fades in on a continuous move, snaps on at a cut, and fades out at the end of the run.
  const fadeIn = f.from === TL.scroll.end + 0.1 ? clamp01((t - f.from) / 0.35) : 1;
  const last = f === FOCI[FOCI.length - 1];
  return { rect: f.rect, k: Math.min(fadeIn, last ? clamp01((f.to - t) / 0.25) : 1) };
};

export const WebPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = cameraAt(t);

  // Speed of the camera this frame (stage px) → a touch of blur on fast moves; plus a short
  // whip blur on each hard cut.
  const prev = cameraAt(Math.max(0, t - 1 / FPS));
  const speed = Math.hypot((cam.cx - prev.cx) * cam.z, (cam.cy - prev.cy) * cam.z) + Math.abs(Math.log(cam.z / prev.z)) * 1200;
  const cutBlur = interpolate(sinceCut(t), [0, 0.1], [7, 0], { extrapolateRight: 'clamp' });
  const blur = Math.min(3.5, Math.max(0, speed - 25) / 90) + cutBlur;

  // Window: tilts in from 3D at the start, tilts away into the end card.
  const intro = easeOutExpo(clamp01(t / 1.4));
  const out = easeInOut(clamp01((t - (OUTRO - 0.2)) / 0.8));
  const z = cam.z * (0.82 + 0.18 * intro) * (1 - 0.22 * out);
  const x = STAGE.width / 2 - cam.cx * z;
  const y = STAGE.height / 2 - cam.cy * z + (1 - intro) * 140 - out * 60;
  const rx = (1 - intro) * 24 + out * 12;
  const ry = (1 - intro) * -18 + out * -22;
  const rz = (1 - intro) * 5 + out * -3;
  const focus = focusAt(t);
  const th = themeAt(t);
  const shadow = THEME[th.top && th.p > 0.5 ? th.top : th.base];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Stage t={t} />

      {t < OUTRO + 0.7 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: WIN.width,
            height: WIN.height,
            transformOrigin: '0 0',
            transform: `translate(${x}px, ${y}px) scale(${z})`,
            perspective: 2400,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
              transformOrigin: '50% 50%',
              opacity: clamp01(t / 0.5) * (1 - out),
              filter: blur > 0.3 || out > 0 ? `blur(${blur + out * 8}px)` : undefined,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: `${shadow.shadow}, 0 0 0 1px ${shadow.frame}`,
            }}
          >
            <WindowChrome t={t} />
            <Viewport t={t}>
              {focus ? <Focus focus={focus.rect} k={focus.k} /> : null}
              <SelectMenu t={t} />
              <ClickRipples t={t} />
              <DownloadChip t={t} />
            </Viewport>
          </div>
        </div>
      ) : null}

      <Outro t={t} />
      <FeatureTitle t={t} />
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
          <Audio src={staticFile('audio/click.wav')} volume={0.3} />
        </Sequence>
      ))}
      {META.keys.map((k, i) => (
        <Sequence key={`k${i}`} from={f(k.t)} durationInFrames={4}>
          <Audio src={staticFile(`audio/${k.key === 'Backspace' ? 'backspace' : k.key === ' ' ? 'space' : `key${((i * 7) % 6) + 1}`}.wav`)} volume={0.24} />
        </Sequence>
      ))}
      {REVEALS.map((r) => (
        <Sequence key={`w${r.at}`} from={f(r.at) - 3} durationInFrames={30}>
          <Audio src={staticFile('audio/whoosh.wav')} volume={0.26} />
        </Sequence>
      ))}
      {[...CUTS, OUTRO - 0.2].map((c) => (
        <Sequence key={`s${c}`} from={Math.max(0, f(c) - 4)} durationInFrames={12}>
          <Audio src={staticFile('audio/swish.wav')} volume={0.16} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
