import React from 'react';
import { Composition } from 'remotion';
import { Promo } from './Promo';
import { VIDEO } from './theme';
import './fonts';

export const RemotionRoot: React.FC = () => (
  <>
    {/* One English video; the typed idea is Egyptian Arabic and the output language is switched to English. */}
    <Composition id="Promo" component={Promo} defaultProps={{ lang: 'en' as const }} {...VIDEO} />
  </>
);
