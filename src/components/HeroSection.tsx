import React, { useEffect, useRef, useState } from 'react';
import { AppLang, Theme, UI_STRINGS } from '../utils/i18n';
import { createParticleField, ParticleField } from '../utils/particles';
import '../styles/xtract-hero.css';
import { HowItWorks } from './HowItWorks';

interface HeroSectionProps {
  lang?: AppLang;
  theme?: Theme;
  onScrollToBuilder?: () => void;
  onOpenLibrary?: () => void;
  children?: React.ReactNode;
}

const reducedMotionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Custom Typewriter Component for looping dynamic title word
 */
const LoopingTitle: React.FC<{
  prefix: string;
  words: readonly string[];
  suffix?: string;
  isAr: boolean;
}> = ({ prefix, words, suffix = '', isAr }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pause, setPause] = useState(false);

  // Typewriter effect state loop
  useEffect(() => {
    if (!words || words.length === 0) return;

    const currentWord = words[wordIndex % words.length];
    const characters = Array.from(currentWord);

    if (pause) {
      const pauseTimer = setTimeout(() => {
        setPause(false);
        setIsDeleting(true);
      }, 1900);
      return () => clearTimeout(pauseTimer);
    }

    if (!isDeleting && subIndex === characters.length) {
      setPause(true);
      return;
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timer = setTimeout(
      () => {
        setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
      },
      isDeleting ? 45 : 110
    );

    return () => clearTimeout(timer);
  }, [subIndex, isDeleting, pause, wordIndex, words]);

  // Reset when language words array changes
  useEffect(() => {
    setWordIndex(0);
    setSubIndex(0);
    setIsDeleting(false);
    setPause(false);
  }, [words]);

  const currentWord = words[wordIndex % words.length] || '';
  const currentChars = Array.from(currentWord).slice(0, subIndex).join('');

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
      {/* Fixed words */}
      <span className="text-zinc-900 dark:text-white font-extrabold tracking-tight">
        {prefix}
      </span>

      {/* Dynamic looping typewriter word - Pure purple only */}
      <span className="relative inline-flex items-center text-purple-600 dark:text-purple-400 font-black">
        {currentChars}
        {/* Blinking forge cursor */}
        <span
          className="inline-block w-[3px] sm:w-[4px] h-[0.9em] mx-1 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(159,120,251,0.8)]"
          aria-hidden="true"
        />
      </span>

      {/* Optional Suffix word (e.g. Prompts in English) */}
      {suffix && (
        <span className="text-zinc-900 dark:text-white font-extrabold tracking-tight">
          {suffix}
        </span>
      )}
    </span>
  );
};

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang = 'ar',
  theme = 'light',
  onScrollToBuilder,
  children,
}) => {
  const t = UI_STRINGS[lang];
  const isAr = lang === 'ar';

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => reducedMotionQuery().matches);
  const isPlaying = !prefersReducedMotion;

  // Follow changes to the reduced-motion setting
  useEffect(() => {
    const query = reducedMotionQuery();
    const onChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Particle field on the canvas that adapts to light/dark theme
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isDark = theme === 'dark';
    const field = createParticleField(canvas, isDark);
    if (!field) return;

    fieldRef.current = field;
    field.resize();

    let pending = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(field.resize);
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      field.pause();
      fieldRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const isVisible = entry.isIntersecting;
        const field = fieldRef.current;
        if (field) {
          if (isVisible && isPlaying) {
            field.play();
          } else {
            field.pause();
          }
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isPlaying]);

  return (
    <>
      <section
        ref={sectionRef}
        className="xhero"
        aria-labelledby="hero-title"
        data-motion={isPlaying ? 'playing' : 'paused'}
        data-inview="true"
      >
        <div className="xhero__content">
          <div className="xhero__heading">
            {/* 2-3 Word Title with Typewriter Looping Effect */}
            <h1
              id="hero-title"
              className="text-[25px] min-[420px]:text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight select-none max-w-4xl mx-auto"
              style={{
                fontFamily: isAr
                  ? "'IBM Plex Sans Arabic', system-ui, sans-serif"
                  : "'Clash Display', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              <LoopingTitle
                prefix={t.heroPrefix}
                words={t.heroWords}
                suffix={t.heroSuffix}
                isAr={isAr}
              />
            </h1>

            {/* Enhanced contrast and typography for hero description in both light and dark modes */}
            <p
              className="text-base sm:text-lg text-zinc-800 dark:text-zinc-100 font-medium max-w-2xl mx-auto leading-relaxed mt-3 sm:mt-4 tracking-normal transition-colors"
              style={{
                fontFamily: isAr
                  ? "'IBM Plex Sans Arabic', system-ui, sans-serif"
                  : "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
              }}
            >
              {t.heroLead}
            </p>

            <HowItWorks lang={lang} onStart={onScrollToBuilder} />
          </div>
        </div>

        {/* Decorative media: theme-adaptive particle field + glowing orb (fixed during scroll) */}
        <div className="xhero__media" aria-hidden="true">
          <div className="xhero-particles">
            <canvas ref={canvasRef} className="xhero-particles__canvas" />
            <div className="xhero-particles__void" />
          </div>
          <div className="xhero-orb">
            <div className="xhero-orb__disc xhero-orb__disc--outer" />
            <div className="xhero-orb__disc xhero-orb__disc--inner" />
          </div>
        </div>
      </section>

      {/* Prompt builder frame positioned with balanced breathing room */}
      {children && (
        <div className="relative w-full overflow-x-clip mt-8 sm:mt-12 lg:mt-16">
          <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-24 sm:pb-36">
            {children}
          </div>
        </div>
      )}
    </>
  );
};
