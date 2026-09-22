import { loadFont as loadFontFile } from '@remotion/fonts';
import { staticFile } from 'remotion';
import { loadFont as loadAlexandria } from '@remotion/google-fonts/Alexandria';
import { loadFont as loadPlexArabic } from '@remotion/google-fonts/IBMPlexSansArabic';
import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import type { Lang } from './theme';

// Same families the site uses (index.html + HeroSection.tsx).
const alexandria = loadAlexandria('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['arabic', 'latin'] });
const plexArabic = loadPlexArabic('normal', { weights: ['500', '600', '700'], subsets: ['arabic', 'latin'] });
const jakarta = loadJakarta('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });
const jetbrains = loadJetBrains('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

loadFontFile({ family: 'Clash Display', url: staticFile('fonts/ClashDisplay-Semibold.woff2'), weight: '600' });
loadFontFile({ family: 'Clash Display', url: staticFile('fonts/ClashDisplay-Bold.woff2'), weight: '700' });

export const FONTS = {
  // Big headlines: Clash Display (EN) / IBM Plex Sans Arabic (AR), as in the site hero.
  display: (lang: Lang) =>
    lang === 'ar' ? `${plexArabic.fontFamily}, ${alexandria.fontFamily}, sans-serif` : `'Clash Display', ${jakarta.fontFamily}, sans-serif`,
  // UI and body text: Alexandria (AR) / Plus Jakarta Sans (EN).
  body: (lang: Lang) =>
    lang === 'ar' ? `${alexandria.fontFamily}, sans-serif` : `${jakarta.fontFamily}, sans-serif`,
  // Structured prompt output: JetBrains Mono for Latin, Alexandria fallback for Arabic glyphs.
  mono: `${jetbrains.fontFamily}, ${alexandria.fontFamily}, monospace`,
  wordmark: `${jakarta.fontFamily}, sans-serif`,
};
