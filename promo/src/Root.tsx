import React from 'react';
import { Composition } from 'remotion';
import { WebPromo } from './web/WebPromo';
import { DURATION_FRAMES, FPS, STAGE } from './web/timing';

export const RemotionRoot: React.FC = () => (
  // Web promo (16:9): the real site captured in light and dark, with voice-over and music.
  <Composition id="PromoWeb" component={WebPromo} durationInFrames={DURATION_FRAMES} fps={FPS} width={STAGE.width} height={STAGE.height} />
);
