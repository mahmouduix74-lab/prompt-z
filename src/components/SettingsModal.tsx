import React, { useState } from 'react';
import { DomainType, DepthType, OutputLanguage } from '../types';
import { EXACT_SYSTEM_INSTRUCTION } from '../constants';
import { buildSystemInstruction } from '../services/gemini';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { X, Code, RotateCcw, Check, Sparkles, Eye } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInstruction: string;
  onSaveSystemInstruction: (instruction: string) => void;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
  exclusions: string;
  lang: AppLang;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  systemInstruction,
  onSaveSystemInstruction,
  domain,
  depth,
  outputLanguage,
  exclusions,
  lang,
}) => {
  const [tempInstruction, setTempInstruction] = useState(systemInstruction);
  const [saveConfirmed, setSaveConfirmed] = useState(false);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setTempInstruction(systemInstruction);
      setSaveConfirmed(false);
    }
  }, [isOpen, systemInstruction]);

  if (!isOpen) return null;

  const t = UI_STRINGS[lang];

  // Exactly what /api/generate would receive right now, with the current selections.
  const effectiveInstruction = buildSystemInstruction({
    baseInstruction: tempInstruction.trim() || EXACT_SYSTEM_INSTRUCTION,
    domain,
    depth,
    outputLanguage,
    exclusions,
  });

  const handleSave = () => {
    onSaveSystemInstruction(tempInstruction.trim() || EXACT_SYSTEM_INSTRUCTION);
    setSaveConfirmed(true);
    setTimeout(() => {
      setSaveConfirmed(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
          <div>
            <h2
              id="settings-title"
              className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>{t.settingsTitle}</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t.settingsDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* System Instruction Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="system-instruction"
                className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"
              >
                <Code className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t.systemInstructionLabel}</span>
              </label>
              <button
                type="button"
                onClick={() => setTempInstruction(EXACT_SYSTEM_INSTRUCTION)}
                className="text-[11px] text-zinc-500 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.resetDefaultInstruction}</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.systemInstructionHelp}
            </p>
            <textarea
              id="system-instruction"
              value={tempInstruction}
              onChange={(e) => setTempInstruction(e.target.value)}
              rows={12}
              dir="ltr"
              className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed select-text"
            />
          </div>

          {/* Read-only: the full instruction as it will be sent */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t.effectiveInstructionLabel}</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.effectiveInstructionHelp}
            </p>
            <pre
              dir="ltr"
              className="w-full max-h-56 overflow-auto p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed select-text"
            >
              {effectiveInstruction}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400">
            {saveConfirmed ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully'}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              {t.close}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors shadow-xs"
            >
              {t.saveAndClose}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
