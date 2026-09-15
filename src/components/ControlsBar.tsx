import React from 'react';
import { DepthType, GeminiModelInfo, OutputLanguage } from '../types';
import { DEPTHS, OUTPUT_LANGUAGES } from '../constants';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { Gauge, Cpu, RefreshCw, Languages, ChevronDown } from 'lucide-react';

interface ControlsBarProps {
  depth: DepthType;
  onChangeDepth: (depth: DepthType) => void;
  outputLanguage: OutputLanguage;
  onChangeOutputLanguage: (language: OutputLanguage) => void;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  models: GeminiModelInfo[];
  isLoadingModels: boolean;
  onRefreshModels: () => void;
  disabled?: boolean;
  lang: AppLang;
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-2xl bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs transition-colors">
      {/* 1. Detail Depth Tabs */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex items-center gap-2 h-5 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
            <Gauge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{t.depthLabel}</span>
          </div>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
            {lang === 'ar' ? activeDepthObj.labelAr : activeDepthObj.labelEn}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 h-10 bg-zinc-100/90 dark:bg-zinc-950/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 items-center">
          {DEPTHS.map((d) => {
            const isSelected = depth === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => onChangeDepth(d.id)}
                aria-pressed={isSelected}
                className={`h-full flex items-center justify-center rounded-lg text-xs font-medium text-center transition-all cursor-pointer truncate disabled:opacity-50 ${
                  isSelected
                    ? 'bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-300 font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10'
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
                {lang === 'ar' ? d.labelAr : d.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Model Picker - Perfectly aligned and consistent with Detail Depth */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between h-5 text-xs">
          <label htmlFor="model-picker" className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
            <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{t.modelLabel}</span>
          </label>
          <button
            type="button"
            onClick={onRefreshModels}
            disabled={disabled || isLoadingModels}
            className="text-[10px] text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 px-1.5 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            title={t.refresh}
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
            <span>{isLoadingModels ? t.refreshing : t.refresh}</span>
          </button>
        </div>

        <div className="relative h-10">
          <select
            id="model-picker"
            value={selectedModel}
            onChange={(e) => onChangeModel(e.target.value)}
            disabled={disabled || models.length === 0}
            className="w-full h-full appearance-none bg-zinc-100/90 dark:bg-zinc-950/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl px-3 pe-8 text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 cursor-pointer disabled:opacity-50 transition-colors truncate shadow-xs"
          >
            {models.length === 0 ? (
              <option value="">{t.modelLabel}...</option>
            ) : (
              models.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 py-1"
                >
                  {m.displayName || m.id}
                </option>
              ))
            )}
          </select>
          <div className="absolute inset-y-0 end-0 flex items-center pe-2.5 pointer-events-none text-zinc-400 dark:text-zinc-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. Output Language - Seamlessly aligned with Detail Depth & AI Model */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between h-5 text-xs">
          <label
            htmlFor="output-language"
            className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium"
          >
            <Languages className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{t.outputLanguageLabel}</span>
          </label>
        </div>

        <div className="relative h-10">
          <select
            id="output-language"
            value={outputLanguage}
            onChange={(e) => onChangeOutputLanguage(e.target.value as OutputLanguage)}
            disabled={disabled}
            className="w-full h-full appearance-none bg-zinc-100/90 dark:bg-zinc-950/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl px-3 pe-8 text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 cursor-pointer disabled:opacity-50 transition-colors truncate shadow-xs"
          >
            {OUTPUT_LANGUAGES.map((option) => (
              <option
                key={option.id}
                value={option.id}
                className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 py-1"
              >
                {lang === 'ar' ? option.labelAr : option.labelEn}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 end-0 flex items-center pe-2.5 pointer-events-none text-zinc-400 dark:text-zinc-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
