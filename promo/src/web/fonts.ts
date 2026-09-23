import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import '../fonts';

// Inter stands in for SF Pro (the site's body stack) exactly as in the capture;
// Montserrat 800 is the PromptZ wordmark face (src/components/Logo.tsx).
export const INTER = `${loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily}, sans-serif`;
export const MONTSERRAT = `${loadMontserrat('normal', { weights: ['800'], subsets: ['latin'] }).fontFamily}, sans-serif`;
export const CLASH = `'Clash Display', ${INTER}`;
