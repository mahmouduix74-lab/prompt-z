import React from 'react';
import { Composition } from 'remotion';
import { Promo } from './Promo';
import { VIDEO } from './theme';
import { WebPromo } from './web/WebPromo';
import { DURATION_FRAMES, FPS, STAGE } from './web/timing';
import './fonts';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Web promo (16:9): the real site captured in light and dark, with voice-over and music. */}
    <Composition id="PromoWeb" component={WebPromo} durationInFrames={DURATION_FRAMES} fps={FPS} width={STAGE.width} height={STAGE.height} />
    {/* Story/Reel cut (9:16): the typed idea is Egyptian Arabic and the output language is switched to English. */}
    <Composition id="Promo" component={Promo} defaultProps={{ lang: 'en' as const }} {...VIDEO} />
  </>
);
