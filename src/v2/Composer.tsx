import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronDown, Loader2, Minus, Undo2, Wand2 } from 'lucide-react';
import { DEPTHS, DOMAINS, OUTPUT_LANGUAGES } from '../constants';
import { DepthType, DomainType, OutputLanguage } from '../types';
import { AppLang } from '../utils/i18n';

interface ComposerProps {
  lang: AppLang;
  text: string;
  onChangeText: (value: string) => void;
  exclusions: string;
  onChangeExclusions: (value: string) => void;
  domain: DomainType;
  onChangeDomain: (value: DomainType) => void;
  depth: DepthType;
  onChangeDepth: (value: DepthType) => void;
  outputLanguage: OutputLanguage;
  onChangeOutputLanguage: (value: OutputLanguage) => void;
  onSubmit: () => void;
  onEnhance: () => void;
  canUndoEnhance: boolean;
  onUndoEnhance: () => void;
  isLoading: boolean;
  isEnhancing: boolean;
}

const focusRing = 'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500';
const iconButton = `inline-flex items-center justify-center h-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300/60 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${focusRing}`;

/** A pill-shaped native select: accessible and comfortable on phones. */
const Pill: React.FC<{
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, options, onChange, disabled }) => (
  <label className="relative inline-flex items-center">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      title={label}
      className={`appearance-none [field-sizing:content] max-w-[60vw] h-9 ps-3.5 pe-8 rounded-full border border-zinc-300 dark:border-zinc-700/80 bg-transparent text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300/60 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer ${focusRing}`}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute end-3 w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
  </label>
);

/** The request box in the middle of the page, ChatGPT style: text first, options in one row under it. */
export const Composer: React.FC<ComposerProps> = (props) => {
  const { lang, text, onChangeText, exclusions, onChangeExclusions, isLoading, isEnhancing } = props;
  const isAr = lang === 'ar';
  const busy = isLoading || isEnhancing;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [showExclusions, setShowExclusions] = useState(() => Boolean(exclusions.trim()));

  // Grows with the text up to a limit, then scrolls.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4))}px`;
  }, [text]);

  useEffect(() => {
    if (exclusions.trim()) setShowExclusions(true);
  }, [exclusions]);

  const submit = () => {
    if (!text.trim() || busy) return;
    props.onSubmit();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full rounded-[28px] bg-[#ebebed] dark:bg-zinc-900 p-3 sm:p-4 text-start"
    >
      <label htmlFor="v2-request" className="sr-only">
        {isAr ? 'اكتب طلبك' : 'Describe what you need'}
      </label>
      <textarea
        id="v2-request"
        ref={textRef}
        value={text}
        dir="auto"
        rows={2}
        onChange={(e) => onChangeText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={isAr ? 'اكتب فكرتك أو طلبك هنا…' : 'Describe what you need…'}
        className="block w-full resize-none bg-transparent px-2 pt-1.5 pb-2 text-[16px] leading-7 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-hidden"
      />

      {showExclusions && (
        <div className="mx-1 mb-2 flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-800/70 px-3">
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">{isAr ? 'من غير:' : 'Without:'}</span>
          <input
            type="text"
            dir="auto"
            value={exclusions}
            onChange={(e) => onChangeExclusions(e.target.value)}
            placeholder={isAr ? 'حاجات مش عايزها في البرومبت' : 'Things you do not want in the prompt'}
            aria-label={isAr ? 'حاجات مش عايزها في البرومبت' : 'Things you do not want in the prompt'}
            className="h-10 flex-1 min-w-0 bg-transparent text-[14px] text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={() => {
              onChangeExclusions('');
              setShowExclusions(false);
            }}
            aria-label={isAr ? 'إزالة' : 'Remove'}
            className={`${iconButton} w-7 h-7`}
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Pill
          label={isAr ? 'المجال' : 'Domain'}
          value={props.domain}
          options={DOMAINS.map((d) => ({ id: d.id, label: isAr ? d.labelAr : d.labelEn }))}
          onChange={(v) => props.onChangeDomain(v as DomainType)}
          disabled={busy}
        />
        <Pill
          label={isAr ? 'مستوى التفصيل' : 'Detail'}
          value={props.depth}
          options={DEPTHS.map((d) => ({ id: d.id, label: isAr ? d.labelAr : d.labelEn }))}
          onChange={(v) => props.onChangeDepth(v as DepthType)}
          disabled={busy}
        />
        <Pill
          label={isAr ? 'لغة البرومبت' : 'Prompt language'}
          value={props.outputLanguage}
          options={OUTPUT_LANGUAGES.map((l) => ({ id: l.id, label: isAr ? l.labelAr : l.labelEn }))}
          onChange={(v) => props.onChangeOutputLanguage(v as OutputLanguage)}
          disabled={busy}
        />
        {!showExclusions && (
          <button
            type="button"
            onClick={() => setShowExclusions(true)}
            disabled={busy}
            className={`h-9 px-3.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-[13px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300/60 dark:hover:bg-zinc-800 cursor-pointer ${focusRing}`}
          >
            {isAr ? '+ من غير…' : '+ Without…'}
          </button>
        )}

        <div className="ms-auto flex items-center gap-1">
          {props.canUndoEnhance ? (
            <button
              type="button"
              onClick={props.onUndoEnhance}
              disabled={busy}
              className={`${iconButton} px-3 gap-1.5 text-[13px] font-medium`}
            >
              <Undo2 className="w-4 h-4" />
              {isAr ? 'تراجع' : 'Undo'}
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onEnhance}
              disabled={busy || !text.trim()}
              title={isAr ? 'حسّن صياغة الطلب' : 'Improve the wording'}
              className={`${iconButton} px-3 gap-1.5 text-[13px] font-medium`}
            >
              {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isAr ? 'حسّن' : 'Enhance'}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={isAr ? 'اكتب البرومبت' : 'Write the prompt'}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300/60 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 cursor-pointer disabled:cursor-not-allowed ${focusRing}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </form>
  );
};
