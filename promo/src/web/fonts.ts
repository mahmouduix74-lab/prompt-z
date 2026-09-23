import { loadFont as loadFontFile } from '@remotion/fonts';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { staticFile } from 'remotion';

// Clash Display: the site's English title face (end card tagline).
loadFontFile({ family: 'Clash Display', url: staticFile('fonts/ClashDisplay-Semibold.woff2'), weight: '600' });
loadFontFile({ family: 'Clash Display', url: staticFile('fonts/ClashDisplay-Bold.woff2'), weight: '700' });

// Inter stands in for SF Pro (the site's body stack) exactly as in the capture;
// Montserrat 800 is the PromptZ wordmark face (src/components/Logo.tsx).
export const INTER = `${loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily}, sans-serif`;
export const MONTSERRAT = `${loadMontserrat('normal', { weights: ['800'], subsets: ['latin'] }).fontFamily}, sans-serif`;
export const CLASH = `'Clash Display', ${INTER}`;
