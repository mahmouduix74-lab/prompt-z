import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  DomainType,
  DepthType,
  OutputLanguage,
  GeminiModelInfo,
  SavedPromptItem,
  GenerationErrorDetails,
} from './types';
import { safeStorage } from './utils/storage';
import { EXACT_SYSTEM_INSTRUCTION, DEPTHS, OUTPUT_LANGUAGES, OPENROUTER_MODEL } from './constants';
import {
  fetchGeminiModels,
  generateStructuredPrompt,
  refinePromptText,
} from './services/gemini';
import { refineLocalPromptText } from './services/localRefiner';
import { generateLocalStructuredPrompt } from './services/localEngine';
import { Theme, AppLang } from './utils/i18n';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { DomainSelector } from './components/DomainSelector';
import { ControlsBar } from './components/ControlsBar';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';
import { Footer } from './components/Footer';
import { LibraryDrawer } from './components/LibraryDrawer';
import { ErrorBanner } from './components/ErrorBanner';
import { SettingsModal } from './components/SettingsModal';
import { Clock } from 'lucide-react';
import { CustomCursor } from './components/CustomCursor';
import { Mascot } from './components/Mascot';

const STORAGE_KEYS = {
  MODELS: 'gemini_available_models',
  SELECTED_MODEL: 'gemini_active_model',
  SYSTEM_INSTRUCTION: 'gemini_system_instruction_v2',
  SAVED_PROMPTS: 'gemini_structured_prompts_library',
  DEPTH: 'prompt_depth_preference',
  OUTPUT_LANGUAGE: 'prompt_output_language_preference',
  THEME: 'theme_preference',
  LANG: 'app_language_preference',
};

export default function App() {
  const builderRef = useRef<HTMLDivElement>(null);

  // Theme state: dark or light (default to light mood as requested)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.THEME) as Theme;
    return saved === 'light' || saved === 'dark' ? saved : 'light';
  });

  // App UI language: Arabic ('ar') or English ('en')
  const [lang, setLang] = useState<AppLang>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.LANG) as AppLang;
    return saved === 'ar' || saved === 'en' ? saved : 'ar';
  });

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // Apply dir & lang to document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    safeStorage.setItem(STORAGE_KEYS.LANG, lang);
  }, [lang]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleLang = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const scrollToBuilder = () => {
    if (!builderRef.current) return;
    const headerOffset = 80;
    const elementPosition = builderRef.current.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'smooth',
    });
  };

  // Editable System Instruction (viewed and saved from the Settings panel)
  const [systemInstruction, setSystemInstruction] = useState<string>(() => {
    return safeStorage.getItem(STORAGE_KEYS.SYSTEM_INSTRUCTION) || EXACT_SYSTEM_INSTRUCTION;
  });

  const handleSaveSystemInstruction = (instruction: string) => {
    setSystemInstruction(instruction);
    safeStorage.setItem(STORAGE_KEYS.SYSTEM_INSTRUCTION, instruction);
  };

  // Models fetched dynamically via the backend. No model name is hardcoded.
  const [models, setModels] = useState<GeminiModelInfo[]>(() => {
    return safeStorage.getJSON<GeminiModelInfo[]>(STORAGE_KEYS.MODELS, []);
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || '';
    // Ids saved before the move to OpenRouter (e.g. "gemini-3.8-flash") have no provider prefix.
    return saved.includes('/') ? saved : OPENROUTER_MODEL;
  });

  // Prompt configuration state
  const [domain, setDomain] = useState<DomainType>('general');
  const [depth, setDepth] = useState<DepthType>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.DEPTH);
    return DEPTHS.some((d) => d.id === saved) ? (saved as DepthType) : 'medium';
  });
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.OUTPUT_LANGUAGE);
    return OUTPUT_LANGUAGES.some((l) => l.id === saved) ? (saved as OutputLanguage) : 'match';
  });
  const [rawText, setRawText] = useState<string>('');
  const [previousRawText, setPreviousRawText] = useState<string | null>(null);
  const [exclusions, setExclusions] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [currentResultTimestamp, setCurrentResultTimestamp] = useState<number | undefined>(undefined);

  // Status & Error state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<GenerationErrorDetails | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  // Modals & Drawers state
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Character animations loop forever, so they can be paused (WCAG 2.2.2).
  // They start paused when the device asks for reduced motion.
  const [charactersPaused, setCharactersPaused] = useState<boolean>(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Saved library state
  const [savedItems, setSavedItems] = useState<SavedPromptItem[]>(() => {
    return safeStorage.getJSON<SavedPromptItem[]>(STORAGE_KEYS.SAVED_PROMPTS, []);
  });

  const handleChangeDepth = (value: DepthType) => {
    setDepth(value);
    safeStorage.setItem(STORAGE_KEYS.DEPTH, value);
  };

  const handleChangeOutputLanguage = (value: OutputLanguage) => {
    setOutputLanguage(value);
    safeStorage.setItem(STORAGE_KEYS.OUTPUT_LANGUAGE, value);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    safeStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
  };

  const toErrorDetails = (err: any, fallbackMessage: string): GenerationErrorDetails => {
    return err?.details || { statusCode: 0, rawMessage: err?.message || fallbackMessage };
  };

  // Fetch models available to the server key. A failure here is not shown to the user:
  // generation keeps the default model and falls back to the local engine if needed.
  const handleFetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const fetchedModels = await fetchGeminiModels();
      setModels(fetchedModels);
      safeStorage.setJSON(STORAGE_KEYS.MODELS, fetchedModels);

      setSelectedModel((current) => {
        if (current && fetchedModels.some((m) => m.id === current)) return current;
        const chosenId = fetchedModels[0]?.id || OPENROUTER_MODEL;
        safeStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, chosenId);
        return chosenId;
      });
    } catch (err: any) {
      console.warn('Could not fetch models, keeping the default model:', toErrorDetails(err, 'Failed to fetch models'));
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Initial load: Fetch models
  useEffect(() => {
    handleFetchModels();
  }, [handleFetchModels]);

  /** The model to send, or null (with an error shown) when none is available. */
  const resolveModel = (): string | null => {
    const model = selectedModel.trim() || models[0]?.id || OPENROUTER_MODEL;
    if (!model) {
      setGenerationError({
        statusCode: 400,
        rawMessage:
          lang === 'ar'
            ? 'لم يتم اختيار نموذج. اضغط "تحديث" بجانب قائمة النماذج ثم اختر نموذجًا.'
            : 'No model selected. Press Refresh next to the model list, then pick a model.',
      });
      return null;
    }
    if (model !== selectedModel) {
      handleSelectModel(model);
    }
    return model;
  };

  // Clarify the wording of the raw text before final structuring
  const handleEnhancePrompt = async () => {
    if (!rawText.trim() || isEnhancing) return;

    setGenerationError(null);
    const model = resolveModel() || OPENROUTER_MODEL;

    setIsEnhancing(true);
    try {
      const refined = await refinePromptText({ rawText, model, domain });
      const finalRefined =
        refined && refined.trim() ? refined.trim() : refineLocalPromptText({ rawText, domain });
      setPreviousRawText(rawText);
      setRawText(finalRefined);
    } catch {
      // Bulletproof fallback: Never block the user with an error dialog!
      const fallbackRefined = refineLocalPromptText({ rawText, domain });
      setPreviousRawText(rawText);
      setRawText(fallbackRefined);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndoEnhance = () => {
    if (previousRawText !== null) {
      setRawText(previousRawText);
      setPreviousRawText(null);
    }
  };

  const saveToLibrary = (item: Omit<SavedPromptItem, 'id'>) => {
    const newItem: SavedPromptItem = {
      ...item,
      id: `prompt_${item.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
    };
    const updatedLibrary = [newItem, ...savedItems.filter((i) => i.output !== item.output)].slice(0, 100);
    setSavedItems(updatedLibrary);
    safeStorage.setJSON(STORAGE_KEYS.SAVED_PROMPTS, updatedLibrary);
  };

  // Main Submit Handler
  const handleGenerate = async () => {
    if (!rawText.trim()) {
      setGenerationError({
        statusCode: 400,
        rawMessage:
          lang === 'ar'
            ? 'يرجى كتابة فكرة أو متطلبات البرومبت أولاً قبل التوليد.'
            : 'Please enter your prompt idea or requirements first.',
      });
      return;
    }

    setGenerationError(null);
    setRetryNotice(null);
    const model = resolveModel();
    if (!model) return;

    setIsLoading(true);
    try {
      const generatedPrompt = await generateStructuredPrompt({
        model,
        rawText,
        exclusions,
        domain,
        depth,
        outputLanguage,
        baseSystemInstruction: systemInstruction,
        onRetry: (attempt, delaySeconds, isPerMinute) => {
          setRetryNotice(
            lang === 'ar'
              ? `تم الوصول إلى ${isPerMinute ? 'حد الطلبات في الدقيقة' : 'حد الطلبات'}. إعادة المحاولة تلقائياً بعد ${delaySeconds} ثانية (محاولة ${attempt} من 3)...`
              : `Rate limit hit${isPerMinute ? ' (per-minute)' : ''}. Retrying in ${delaySeconds}s (attempt ${attempt} of 3)...`
          );
        },
      });

      const finalOutput =
        generatedPrompt && generatedPrompt.trim()
          ? generatedPrompt.trim()
          : generateLocalStructuredPrompt({
              rawText,
              domain,
              depth,
              outputLanguage,
            });

      const now = Date.now();
      setOutput(finalOutput);
      setCurrentResultTimestamp(now);

      // Auto save to local library
      saveToLibrary({
        rawInput: rawText.trim(),
        exclusions: exclusions.trim() || undefined,
        domain,
        depth,
        outputLanguage,
        model,
        output: finalOutput,
        timestamp: now,
      });
    } catch (err: any) {
      console.warn('Remote generation issue handled gracefully by local engine:', err);
      const fallbackPrompt = generateLocalStructuredPrompt({
        rawText,
        domain,
        depth,
        outputLanguage,
      });
      const now = Date.now();
      setOutput(fallbackPrompt);
      setCurrentResultTimestamp(now);
      saveToLibrary({
        rawInput: rawText.trim(),
        exclusions: exclusions.trim() || undefined,
        domain,
        depth,
        outputLanguage,
        model,
        output: fallbackPrompt,
        timestamp: now,
      });
    } finally {
      setIsLoading(false);
      setRetryNotice(null);
    }
  };

  // Manual save to library
  const handleManualSaveToLibrary = () => {
    if (!output.trim()) return;
    saveToLibrary({
      rawInput: rawText.trim() || 'Prompt Snippet',
      exclusions: exclusions.trim() || undefined,
      domain,
      depth,
      outputLanguage,
      model: selectedModel,
      output: output.trim(),
      timestamp: Date.now(),
    });
  };

  // Check if current output is saved in library
  const isCurrentOutputSaved = Boolean(
    output.trim() && savedItems.some((i) => i.output.trim() === output.trim())
  );

  // Clear Input & Output directly
  const handleClear = () => {
    setRawText('');
    setExclusions('');
    setOutput('');
    setCurrentResultTimestamp(undefined);
    setGenerationError(null);
  };

  // Local Library Actions
  const handleReopenSavedItem = (item: SavedPromptItem) => {
    setRawText(item.rawInput);
    setExclusions(item.exclusions || '');
    setDomain(item.domain);
    handleChangeDepth(item.depth);
    if (item.outputLanguage) {
      handleChangeOutputLanguage(item.outputLanguage);
    }
    setOutput(item.output);
    setCurrentResultTimestamp(item.timestamp);
    if (item.model) {
      handleSelectModel(item.model);
    }
    setGenerationError(null);
    setIsLibraryOpen(false);
    scrollToBuilder();
  };

  const handleDeleteSavedItem = (id: string) => {
    const updated = savedItems.filter((item) => item.id !== id);
    setSavedItems(updated);
    safeStorage.setJSON(STORAGE_KEYS.SAVED_PROMPTS, updated);
  };

  const handleClearAllSaved = () => {
    setSavedItems([]);
    safeStorage.removeItem(STORAGE_KEYS.SAVED_PROMPTS);
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#FAFAFC] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200 overflow-x-clip ${
        charactersPaused ? 'pz-characters-paused' : ''
      }`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Header - PromptZ brand header with navigation & logo */}
      <Header
        activeModel={selectedModel}
        savedCount={savedItems.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onToggleLang={toggleLang}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onScrollToBuilder={scrollToBuilder}
      />

      {/* Hero Section with Embedded Glassmorphic Prompt Builder */}
      <HeroSection
        lang={lang}
        theme={theme}
        onScrollToBuilder={scrollToBuilder}
        onOpenLibrary={() => setIsLibraryOpen(true)}
      >
        <main
          ref={builderRef}
          id="prompt-builder"
          className="w-full text-left flex flex-col gap-6 relative z-20 scroll-mt-24"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          {/* Ambient Glow Emitters for Glassmorphism Refraction - Pure Purple Only */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-3/4 max-w-[700px] h-[350px] rounded-full bg-gradient-to-r from-purple-600/25 via-purple-500/20 to-violet-600/25 blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-1/4 -left-12 w-80 h-80 rounded-full bg-gradient-to-br from-purple-600/20 to-violet-500/15 blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-10 -right-12 w-96 h-96 rounded-full bg-gradient-to-tl from-violet-600/20 via-purple-600/25 to-purple-500/20 blur-3xl pointer-events-none -z-10" />

          {/* Retry countdown notice */}
          {retryNotice && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 backdrop-blur-md border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 animate-pulse">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{retryNotice}</span>
            </div>
          )}

          {/* Error Banner */}
          <ErrorBanner
            error={generationError}
            onDismiss={() => setGenerationError(null)}
            onRetry={handleGenerate}
          />

          {/* Clean, Refined Frame for Prompt Workspace Console */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative mt-6 sm:mt-8"
          >
            {/* Animated Character sitting on top border of Domain Context frame */}
            <Mascot lang={lang} />

            <div className="relative rounded-3xl p-4 sm:p-6 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm transition-all overflow-hidden flex flex-col gap-4">
            {/* 1. Domain Selector */}
            <DomainSelector
              selectedDomain={domain}
              onSelectDomain={setDomain}
              disabled={isLoading || isEnhancing}
              lang={lang}
            />

            {/* 2. Global Controls Bar (Detail Depth, AI Model, Output Language) - Perfectly aligned across both consoles */}
            <ControlsBar
              depth={depth}
              onChangeDepth={handleChangeDepth}
              outputLanguage={outputLanguage}
              onChangeOutputLanguage={handleChangeOutputLanguage}
              selectedModel={selectedModel}
              onChangeModel={handleSelectModel}
              models={models}
              isLoadingModels={isLoadingModels}
              onRefreshModels={handleFetchModels}
              disabled={isLoading || isEnhancing}
              lang={lang}
            />

            {/* 3. Two-Column Cockpit Layout: Input (Raw Prompt) & Output (Structured Prompt) - Perfectly Aligned */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 items-stretch text-left" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex flex-col h-full">
                <InputPanel
                  rawText={rawText}
                  onChangeText={setRawText}
                  exclusions={exclusions}
                  onChangeExclusions={setExclusions}
                  onSubmit={handleGenerate}
                  onClear={handleClear}
                  onEnhancePrompt={handleEnhancePrompt}
                  isEnhancing={isEnhancing}
                  canUndoEnhance={Boolean(previousRawText)}
                  onUndoEnhance={handleUndoEnhance}
                  isLoading={isLoading}
                  lang={lang}
                />
              </div>

              {/* Output Console with Formatted / Raw / Blocks view modes */}
              <div className="flex flex-col h-full">
                <OutputPanel
                  output={output}
                  isLoading={isLoading}
                  modelUsed={selectedModel}
                  timestamp={currentResultTimestamp}
                  lang={lang}
                  theme={theme}
                  onSaveToLibrary={handleManualSaveToLibrary}
                  isSaved={isCurrentOutputSaved}
                  onOpenLibrary={() => setIsLibraryOpen(true)}
                  savedCount={savedItems.length}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </main>
      </HeroSection>

      {/* Bottom Footer */}
      <Footer
        lang={lang}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        savedCount={savedItems.length}
      />

      {/* Local Library Drawer */}
      <LibraryDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedItems={savedItems}
        onReopenItem={handleReopenSavedItem}
        onDeleteItem={handleDeleteSavedItem}
        onClearAll={handleClearAllSaved}
        lang={lang}
      />

      {/* Settings: view and edit the system instruction that is sent */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        systemInstruction={systemInstruction}
        onSaveSystemInstruction={handleSaveSystemInstruction}
        domain={domain}
        depth={depth}
        outputLanguage={outputLanguage}
        exclusions={exclusions}
        lang={lang}
      />

      {/* Custom Cursor & Companion Character Layer */}
      <CustomCursor />
    </div>
  );
}
