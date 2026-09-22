import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { Background } from './components/Background';
import { Hook } from './scenes/Hook';
import { TypeIdea } from './scenes/TypeIdea';
import { LanguagePick } from './scenes/LanguagePick';
import { Generate } from './scenes/Generate';
import { Result } from './scenes/Result';
import { Outro } from './scenes/Outro';
import { Lang, SCENES, TRANSITION_FRAMES } from './theme';

const soft = linearTiming({ durationInFrames: TRANSITION_FRAMES });
const snappy = springTiming({ durationInFrames: TRANSITION_FRAMES, config: { damping: 200 } });

// Scenes paint no background of their own: the Background layer runs on the global
// frame underneath, so the purple glows move continuously through every transition.
export const Promo: React.FC<{ lang: Lang }> = ({ lang }) => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.hook}>
        <Hook lang={lang} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={snappy} />
      <TransitionSeries.Sequence durationInFrames={SCENES.type}>
        <TypeIdea lang={lang} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={soft} />
      <TransitionSeries.Sequence durationInFrames={SCENES.language}>
        <LanguagePick lang={lang} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={soft} />
      <TransitionSeries.Sequence durationInFrames={SCENES.generate}>
        <Generate lang={lang} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={soft} />
      <TransitionSeries.Sequence durationInFrames={SCENES.result}>
        <Result lang={lang} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={snappy} />
      <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
        <Outro lang={lang} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
