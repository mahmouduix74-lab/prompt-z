import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Languages, Moon, Sun } from 'lucide-react';
import { DepthType, DomainType, GenerationErrorDetails, OutputLanguage, SavedPromptItem } from '../types';
import { DEPTHS, OPENROUTER_MODEL, OUTPUT_LANGUAGES } from '../constants';
import { safeStorage } from '../utils/storage';
import { AppLang, Theme, UI_STRINGS } from '../utils/i18n';
import { generateStructuredPrompt, refinePromptText } from '../services/api';
import { refineLocalPromptText } from '../services/localRefiner';
import { AccountState, DailyLimitError, fetchAccount, sendFeedback } from '../services/account';
import { deleteHistory, fetchHistory, saveHistory } from '../services/history';
import type { ClarifyingQuestion } from '../prompting';
import { AccountMenu, LimitDialog, SignInDialog } from '../components/AccountMenu';
import { ClarifyDialog, FeedbackBar, ServiceNotice } from '../components/PromptAssist';
import { ErrorBanner } from '../components/ErrorBanner';
import { LibraryDrawer } from '../components/LibraryDrawer';
import CursorRingField from './CursorRingField';
import { Composer } from './Composer';
import { ResultCard } from './ResultCard';
import { TypingTitle } from './TypingTitle';

// History, depth, language and the UI language are shared with the classic page; the theme is not,
// because this page follows the device by default.
const STORAGE_KEYS = {
  SAVED_PROMPTS: 'gemini_structured_prompts_library',
  DEPTH: 'prompt_depth_preference',
  OUTPUT_LANGUAGE: 'prompt_output_language_preference',
  LANG: 'app_language_preference',
  THEME: 'v2_theme',
};

/** A soft halo behind the request box: light on the dark theme, a faint grey shade on the light one. */
const GLOW: Record<Theme, string> = {
  dark: 'radial-gradient(ellipse 45% 35% at 50% 62%, rgba(255,255,255,0.14), transparent 70%)',
  light: 'radial-gradient(ellipse 45% 35% at 50% 62%, rgba(24,24,27,0.09), transparent 70%)',
};

/** The field's colors per theme: greys only, on pure white or pure black. */
const FIELD_THEME: Record<Theme, { background: string; colors: string[] }> = {
  light: { background: '#ffffff', colors: ['#52525b', '#71717a', '#a1a1aa'] },
  dark: { background: '#000000', colors: ['#d4d4d8', '#a1a1aa', '#52525b'] },
};

/**
 * The field is kept light, like a texture behind the text: small dashes (the component's default
 * dot size is 120) and the camera pulled back a little (default 160) so the ring reads as an arc.
 */
const DOT_SIZE = 35;
const CAMERA_DISTANCE = 190;

const headerButton =
  'inline-flex items-center justify-center gap-1.5 h-9 min-w-9 px-2.5 rounded-full text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-900/5 dark:hover:bg-white/10 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AppV2() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [lang, setLang] = useState<AppLang>(() => (safeStorage.getItem(STORAGE_KEYS.LANG) === 'en' ? 'en' : 'ar'));
  const isAr = lang === 'ar';
  // Hero title and lead come from the classic page's strings, so both pages say the same thing.
  const t = UI_STRINGS[lang];

  // The mono class turns the site's purple into greys for the dialogs shared with the classic page.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('pz-mono');
    root.classList.toggle('dark', theme === 'dark');
    safeStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', isAr ? 'rtl' : 'ltr');
    document.title = isAr ? 'PromptZ: من الفكرة للبرومبت' : 'PromptZ: from idea to prompt';
    safeStorage.setItem(STORAGE_KEYS.LANG, lang);
  }, [lang, isAr]);

  // Lighter field on phones and small machines; a still one when the device asks for less motion.
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [density] = useState(() =>
    window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4 ? 170 : 300
  );

  // Request settings
  const [domain, setDomain] = useState<DomainType>('general');
  const [depth, setDepth] = useState<DepthType>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.DEPTH);
    return DEPTHS.some((d) => d.id === saved) ? (saved as DepthType) : 'medium';
  });
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.OUTPUT_LANGUAGE);
    return OUTPUT_LANGUAGES.some((l) => l.id === saved) ? (saved as OutputLanguage) : 'match';
  });
  const changeDepth = (value: DepthType) => {
    setDepth(value);
    safeStorage.setItem(STORAGE_KEYS.DEPTH, value);
  };
  const changeOutputLanguage = (value: OutputLanguage) => {
    setOutputLanguage(value);
    safeStorage.setItem(STORAGE_KEYS.OUTPUT_LANGUAGE, value);
  };

  const [rawText, setRawText] = useState('');
  const [previousRawText, setPreviousRawText] = useState<string | null>(null);
  const [exclusions, setExclusions] = useState('');
  const [output, setOutput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generationError, setGenerationError] = useState<GenerationErrorDetails | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyingQuestion[] | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{ id: number; request: string; prompt: string } | null>(null);
  const lastRunRef = useRef<{ skipClarify: boolean; text: string }>({ skipClarify: false, text: '' });
  const resultRef = useRef<HTMLDivElement>(null);

  // Account, daily limit and sign-in
  const [account, setAccount] = useState<AccountState | null>(null);
  const [limitNotice, setLimitNotice] = useState<{ canSignIn: boolean; limit?: number } | null>(null);
  const [signInIssue, setSignInIssue] = useState<'error' | 'expired' | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const closeSignIn = useCallback(() => setIsSignInOpen(false), []);
  const closeLimitNotice = useCallback(() => setLimitNotice(null), []);
  const closeClarify = useCallback(() => setClarifyQuestions(null), []);

  const refreshAccount = useCallback(async () => setAccount(await fetchAccount()), []);
  useEffect(() => {
    refreshAccount();
    const params = new URLSearchParams(window.location.search);
    const signin = params.get('signin');
    if (signin) {
      if (signin === 'error' || signin === 'expired') setSignInIssue(signin);
      params.delete('signin');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  }, [refreshAccount]);

  const handleDailyLimit = (err: DailyLimitError) => {
    setLimitNotice({ canSignIn: err.canSignIn, limit: err.usage?.limit });
    refreshAccount();
  };

  // History: in the account when signed in, otherwise in this browser (same rules as the classic page).
  const [savedItems, setSavedItems] = useState<SavedPromptItem[]>(() =>
    safeStorage.getJSON<SavedPromptItem[]>(STORAGE_KEYS.SAVED_PROMPTS, [])
  );
  const signedIn = Boolean(account?.user);
  const accountEmail = account?.user?.email;
  const accountLoaded = account !== null;
  useEffect(() => {
    if (!accountLoaded) return;
    let cancelled = false;
    (async () => {
      if (!accountEmail) {
        setSavedItems(safeStorage.getJSON<SavedPromptItem[]>(STORAGE_KEYS.SAVED_PROMPTS, []));
        return;
      }
      const local = safeStorage.getJSON<SavedPromptItem[]>(STORAGE_KEYS.SAVED_PROMPTS, []);
      if (local.length && (await saveHistory(local))) safeStorage.removeItem(STORAGE_KEYS.SAVED_PROMPTS);
      const remote = await fetchHistory();
      if (!cancelled && remote) setSavedItems(remote);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountLoaded, accountEmail]);

  const saveToLibrary = (item: Omit<SavedPromptItem, 'id'>) => {
    const newItem: SavedPromptItem = { ...item, id: `prompt_${item.timestamp}_${crypto.randomUUID().slice(0, 8)}` };
    const updated = [newItem, ...savedItems.filter((i) => i.output !== item.output)].slice(0, 100);
    setSavedItems(updated);
    if (signedIn) {
      saveHistory([newItem]);
      savedItems.filter((i) => i.output === item.output).forEach((i) => deleteHistory(i.id));
    } else {
      safeStorage.setJSON(STORAGE_KEYS.SAVED_PROMPTS, updated);
    }
  };

  const scrollToResult = () =>
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    );

  const runGenerate = async (opts: { skipClarify?: boolean; requestText?: string } = {}) => {
    const text = (opts.requestText ?? rawText).trim();
    if (!text) return;

    setGenerationError(null);
    setRetryNotice(null);
    setServiceDown(false);
    setClarifyQuestions(null);
    const skipClarify = Boolean(opts.skipClarify);
    lastRunRef.current = { skipClarify, text };

    setIsLoading(true);
    scrollToResult();
    try {
      const result = await generateStructuredPrompt({
        model: OPENROUTER_MODEL,
        rawText: text,
        exclusions,
        domain,
        depth,
        outputLanguage,
        skipClarify,
        onRetry: (attempt, delaySeconds) =>
          setRetryNotice(
            isAr
              ? `الخدمة مشغولة. هنحاول تاني بعد ${delaySeconds} ثانية (محاولة ${attempt} من 3)…`
              : `Busy right now. Retrying in ${delaySeconds}s (attempt ${attempt} of 3)…`
          ),
      });

      if ('clarify' in result) {
        setClarifyQuestions(result.clarify);
        return;
      }

      const prompt = result.prompt.trim();
      const now = Date.now();
      setOutput(prompt);
      setFeedbackTarget({ id: now, request: text, prompt });
      saveToLibrary({
        rawInput: text,
        exclusions: exclusions.trim() || undefined,
        domain,
        depth,
        outputLanguage,
        model: OPENROUTER_MODEL,
        output: prompt,
        timestamp: now,
      });
      refreshAccount();
    } catch (err: any) {
      if (err instanceof DailyLimitError) {
        handleDailyLimit(err);
        return;
      }
      console.warn('Generation failed:', err);
      setServiceDown(true);
    } finally {
      setIsLoading(false);
      setRetryNotice(null);
    }
  };

  const handleClarifySubmit = (answers: string[]) => {
    const text = answers.length
      ? `${rawText.trim()}\n\n${isAr ? 'تفاصيل إضافية' : 'More details'}:\n${answers.map((a) => `- ${a}`).join('\n')}`
      : rawText;
    if (answers.length) setRawText(text);
    runGenerate({ skipClarify: true, requestText: text });
  };

  const handleEnhance = async () => {
    if (!rawText.trim() || isEnhancing) return;
    setGenerationError(null);
    setIsEnhancing(true);
    try {
      const refined = await refinePromptText({ rawText, model: OPENROUTER_MODEL, domain });
      setPreviousRawText(rawText);
      setRawText(refined?.trim() || refineLocalPromptText({ rawText, domain }));
      refreshAccount();
    } catch (err) {
      if (err instanceof DailyLimitError) {
        handleDailyLimit(err);
        return;
      }
      setPreviousRawText(rawText);
      setRawText(refineLocalPromptText({ rawText, domain }));
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSendFeedback = (rating: 'up' | 'down', comment: string) =>
    feedbackTarget
      ? sendFeedback({ rating, comment, request: feedbackTarget.request, prompt: feedbackTarget.prompt, domain, depth, outputLanguage })
      : Promise.resolve(false);

  const reopenSaved = (item: SavedPromptItem) => {
    setRawText(item.rawInput);
    setExclusions(item.exclusions || '');
    setDomain(item.domain);
    changeDepth(item.depth);
    if (item.outputLanguage) changeOutputLanguage(item.outputLanguage);
    setOutput(item.output);
    setFeedbackTarget(null);
    setIsLibraryOpen(false);
    scrollToResult();
  };
  const deleteSaved = (id: string) => {
    const updated = savedItems.filter((i) => i.id !== id);
    setSavedItems(updated);
    if (signedIn) deleteHistory(id);
    else safeStorage.setJSON(STORAGE_KEYS.SAVED_PROMPTS, updated);
  };
  const clearSaved = () => {
    setSavedItems([]);
    if (signedIn) deleteHistory();
    else safeStorage.removeItem(STORAGE_KEYS.SAVED_PROMPTS);
  };

  const field = FIELD_THEME[theme];
  const showResult = isLoading || Boolean(output);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="relative min-h-screen flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-x-clip"
    >
      {/* The field fills the first screen and fades into the page below it. */}
      <div className="absolute inset-x-0 top-0 h-[100svh] pointer-events-none select-none" aria-hidden="true">
        <CursorRingField
          background={field.background}
          colors={field.colors}
          density={density}
          dotSize={DOT_SIZE}
          cameraDistance={CAMERA_DISTANCE}
          paused={reducedMotion}
          className="absolute inset-0"
        />
        <div className="absolute inset-0" style={{ background: GLOW[theme] }} />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white dark:to-black" />
      </div>

      <header className="relative z-10 w-full">
        <div className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <a href="/v2" className="text-[22px] font-[800] tracking-[-0.025em] text-zinc-900 dark:text-white" style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }} dir="ltr">
            PromptZ
          </a>
          <nav className="flex items-center gap-1" aria-label={isAr ? 'أدوات' : 'Tools'}>
            <button type="button" onClick={() => setIsLibraryOpen(true)} className={headerButton} aria-label={isAr ? 'السجل' : 'History'}>
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'السجل' : 'History'}</span>
              {savedItems.length > 0 && <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">{savedItems.length}</span>}
            </button>
            <button
              type="button"
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className={headerButton}
              aria-label={isAr ? 'Switch to English' : 'التبديل للعربية'}
            >
              <Languages className="w-4 h-4" />
              <span>{isAr ? 'EN' : 'ع'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={headerButton}
              aria-label={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : isAr ? 'الوضع الداكن' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <AccountMenu account={account} lang={lang} onSignIn={() => setIsSignInOpen(true)} onOpenLibrary={() => setIsLibraryOpen(true)} />
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full">
        <section className="mx-auto max-w-3xl px-4 sm:px-6 min-h-[calc(100svh-4rem)] flex flex-col justify-center items-center text-center pb-16">
          <h1 className="text-balance text-[34px] sm:text-[52px] leading-[1.15] font-extrabold tracking-[-0.03em] text-zinc-950 dark:text-white">
            <TypingTitle prefix={t.heroPrefix} words={t.heroWords} suffix={t.heroSuffix} still={reducedMotion} />
          </h1>
          <p className="mt-4 max-w-xl text-balance text-[16px] sm:text-[18px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t.heroLead}
          </p>

          <div className="mt-9 w-full">
            <Composer
              lang={lang}
              text={rawText}
              onChangeText={(v) => {
                setRawText(v);
                if (previousRawText !== null) setPreviousRawText(null);
              }}
              exclusions={exclusions}
              onChangeExclusions={setExclusions}
              domain={domain}
              onChangeDomain={setDomain}
              depth={depth}
              onChangeDepth={changeDepth}
              outputLanguage={outputLanguage}
              onChangeOutputLanguage={changeOutputLanguage}
              onSubmit={() => runGenerate()}
              onEnhance={handleEnhance}
              canUndoEnhance={previousRawText !== null}
              onUndoEnhance={() => {
                if (previousRawText !== null) setRawText(previousRawText);
                setPreviousRawText(null);
              }}
              isLoading={isLoading}
              isEnhancing={isEnhancing}
            />
          </div>

          <div className="mt-4 w-full flex flex-col gap-3 text-start">
            {retryNotice && (
              <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
                {retryNotice}
              </p>
            )}
            {signInIssue && (
              <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/85 px-4 py-2 text-sm">
                <span>
                  {signInIssue === 'expired'
                    ? isAr
                      ? 'انتهت صلاحية رابط الدخول أو استُخدم من قبل. اطلب رابطًا جديدًا.'
                      : 'That sign-in link has expired or was already used. Ask for a new one.'
                    : isAr
                      ? 'لم يكتمل تسجيل الدخول. حاول مرة أخرى.'
                      : 'Sign-in did not complete. Please try again.'}
                </span>
                <button type="button" onClick={() => setSignInIssue(null)} className={headerButton}>
                  {isAr ? 'إغلاق' : 'Dismiss'}
                </button>
              </div>
            )}
            {serviceDown && (
              <ServiceNotice
                lang={lang}
                isLoading={isLoading}
                onRetry={() => runGenerate({ skipClarify: lastRunRef.current.skipClarify, requestText: lastRunRef.current.text })}
                onDismiss={() => setServiceDown(false)}
              />
            )}
            <ErrorBanner error={generationError} onDismiss={() => setGenerationError(null)} onRetry={() => runGenerate()} />
          </div>
        </section>

        {showResult && (
          <section ref={resultRef} className="mx-auto max-w-3xl px-4 sm:px-6 pb-20 scroll-mt-6 flex flex-col gap-3">
            <ResultCard lang={lang} prompt={output} isLoading={isLoading} />
            {feedbackTarget && feedbackTarget.prompt === output && !isLoading && (
              <FeedbackBar key={feedbackTarget.id} lang={lang} onSend={handleSendFeedback} />
            )}
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4 text-[13px] text-zinc-500 dark:text-zinc-400">
          <span dir="ltr">© {new Date().getFullYear()} PromptZ</span>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-zinc-900 dark:hover:text-white">{isAr ? 'الشروط' : 'Terms'}</a>
            <a href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">{isAr ? 'الخصوصية' : 'Privacy'}</a>
            <a href="/" className="hover:text-zinc-900 dark:hover:text-white">{isAr ? 'النسخة الكلاسيكية' : 'Classic version'}</a>
          </nav>
        </div>
      </footer>

      <SignInDialog open={isSignInOpen} lang={lang} account={account} onClose={closeSignIn} />
      <LimitDialog
        open={Boolean(limitNotice)}
        lang={lang}
        canSignIn={limitNotice?.canSignIn ?? false}
        limit={limitNotice?.limit}
        onSignIn={() => setIsSignInOpen(true)}
        onClose={closeLimitNotice}
      />
      <ClarifyDialog
        open={Boolean(clarifyQuestions)}
        lang={lang}
        questions={clarifyQuestions || []}
        isLoading={isLoading}
        onSubmit={handleClarifySubmit}
        onClose={closeClarify}
      />
      <LibraryDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedItems={savedItems}
        onReopenItem={reopenSaved}
        onDeleteItem={deleteSaved}
        onClearAll={clearSaved}
        lang={lang}
      />
    </div>
  );
}
