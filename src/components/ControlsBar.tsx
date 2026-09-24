import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DepthType, ModelInfo, OutputLanguage } from '../types';
import { DEPTHS, OUTPUT_LANGUAGES } from '../constants';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { Gauge, Languages, ChevronDown, Check } from 'lucide-react';

interface ControlsBarProps {
  depth: DepthType;
  onChangeDepth: (depth: DepthType) => void;
  outputLanguage: OutputLanguage;
  onChangeOutputLanguage: (language: OutputLanguage) => void;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  models: ModelInfo[];
  isLoadingModels: boolean;
  onRefreshModels: () => void;
  disabled?: boolean;
  lang: AppLang;
}

/**
 * Output language picker. A custom listbox rather than a native <select>, so the options always
 * open below the field (a native select opens upward when the browser thinks there is no room).
 */
function OutputLanguageMenu({
  value,
  onChange,
  disabled,
  lang,
}: {
  value: OutputLanguage;
  onChange: (value: OutputLanguage) => void;
  disabled?: boolean;
  lang: AppLang;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = (o: (typeof OUTPUT_LANGUAGES)[number]) => (lang === 'ar' ? o.labelAr : o.labelEn);
  const current = OUTPUT_LANGUAGES.find((o) => o.id === value) ?? OUTPUT_LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, OUTPUT_LANGUAGES.findIndex((o) => o.id === value)));
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, value]);

  const choose = (index: number) => {
    onChange(OUTPUT_LANGUAGES[index].id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(OUTPUT_LANGUAGES.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative h-9" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        id="output-language"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="output-language-label output-language"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-full flex items-center justify-between gap-2 bg-zinc-100/90 dark:bg-zinc-950/80 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 text-sm font-medium text-start cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus-visible:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500/30"
      >
        <span className="truncate">{label(current)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby="output-language-label"
          aria-activedescendant={`output-language-${OUTPUT_LANGUAGES[active].id}`}
          className="absolute top-full mt-1.5 inset-x-0 z-30 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
        >
          {OUTPUT_LANGUAGES.map((option, i) => {
            const selected = option.id === value;
            return (
              <li
                key={option.id}
                id={`output-language-${option.id}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex items-center justify-between gap-2 h-9 px-3 rounded-lg text-sm cursor-pointer ${
                  i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                } ${selected ? 'text-purple-700 dark:text-purple-300 font-semibold' : 'text-zinc-700 dark:text-zinc-200'}`}
              >
                <span className="truncate">{label(option)}</span>
                {selected && <Check className="w-4 h-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  depth,
  onChangeDepth,
  outputLanguage,
  onChangeOutputLanguage,
  selectedModel,
  onChangeModel,
  models,
  isLoadingModels,
  onRefreshModels,
  disabled,
  lang,
}) => {
  const t = UI_STRINGS[lang];
  const activeDepthObj = DEPTHS.find((d) => d.id === depth) || DEPTHS[1];

  return (
    <div className="relative z-20 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-2xl bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs transition-colors">
      {/* 1. Detail Depth Tabs */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex items-center gap-2 h-6 text-sm">
          <div className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50 font-bold">
            <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{t.depthLabel}</span>
          </div>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
            {lang === 'ar' ? activeDepthObj.labelAr : activeDepthObj.labelEn}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 p-0.5 h-9 bg-zinc-100/90 dark:bg-zinc-950/80 rounded-xl border border-zinc-300/80 dark:border-zinc-700/80 items-center">
          {DEPTHS.map((d) => {
            const isSelected = depth === d.id;
            return (
              <motion.button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => onChangeDepth(d.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                aria-pressed={isSelected}
                className={`relative isolate h-full flex items-center justify-center rounded-lg text-sm font-medium text-center transition-colors cursor-pointer truncate disabled:opacity-50 ${
                  isSelected
                    ? 'text-purple-700 dark:text-purple-300 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-900/50'
                }`}
                title={
                  lang === 'ar'
                    ? d.id === 'ultra'
                      ? 'شامل (أقصى دقة وتفاصيل)'
                      : d.labelAr
                    : d.id === 'ultra'
                    ? 'Ultra (Comprehensive)'
                    : d.labelEn
                }
              >
                {isSelected && (
                  <motion.div
                    layoutId="depth-tab-indicator"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg border border-purple-500/80 dark:border-purple-400/70 -z-10"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                  />
                )}
                <span className="relative z-10">{lang === 'ar' ? d.labelAr : d.labelEn}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 2. Output Language */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between h-6 text-sm">
          <label
            id="output-language-label"
            htmlFor="output-language"
            className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50 font-bold"
          >
            <Languages className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{t.outputLanguageLabel}</span>
          </label>
        </div>

        <OutputLanguageMenu
          value={outputLanguage}
          onChange={onChangeOutputLanguage}
          disabled={disabled}
          lang={lang}
        />
      </div>
    </div>
  );
};
