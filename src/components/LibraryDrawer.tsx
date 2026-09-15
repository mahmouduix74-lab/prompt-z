import React, { useState, useMemo } from 'react';
import { SavedPromptItem } from '../types';
import { DOMAINS, DEPTHS } from '../constants';
import { copyToClipboard } from '../utils/clipboard';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { History, X, Trash2, ArrowUpRight, ArrowUpLeft, Copy, Check, Search, Calendar, Tag } from 'lucide-react';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedItems: SavedPromptItem[];
  onReopenItem: (item: SavedPromptItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  lang: AppLang;
}

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({
  isOpen,
  onClose,
  savedItems,
  onReopenItem,
  onDeleteItem,
  onClearAll,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const t = UI_STRINGS[lang];

  const getDomainOption = (domainId: string) => {
    return DOMAINS.find((d) => d.id === domainId);
  };

  const getDomainLabel = (domainId: string) => {
    const opt = getDomainOption(domainId);
    if (!opt) return domainId;
    return lang === 'ar' ? opt.labelAr : opt.labelEn;
  };

  const getDepthLabel = (depthId: string) => {
    const opt = DEPTHS.find((d) => d.id === depthId);
    if (!opt) return depthId;
    return lang === 'ar' ? opt.labelAr.split(' ')[0] : opt.labelEn;
  };

  const filteredItems = useMemo(() => {
    return savedItems.filter((item) => {
      const matchesDomain =
        selectedDomainFilter === 'all' || item.domain === selectedDomainFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.rawInput.toLowerCase().includes(q) ||
        item.output.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }, [savedItems, selectedDomainFilter, searchQuery]);

  const handleCopyItem = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleConfirmClearAll = () => {
    if (window.confirm(t.confirmClearAll)) {
      onClearAll();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Drawer Overlay backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Content */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {t.libraryTitle}
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {savedItems.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {savedItems.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title={t.clearAll}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Domain Filter Bar */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-3 pr-8 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none no-scrollbar text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedDomainFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                selectedDomainFilter === 'all'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.filterAll}
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDomainFilter(d.id)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedDomainFilter === d.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {lang === 'ar' ? d.labelAr : d.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* List of saved prompts */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-zinc-400 dark:text-zinc-500 space-y-2">
              <History className="w-8 h-8 opacity-40" />
              <p className="text-xs leading-relaxed max-w-xs">{t.libraryEmpty}</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isCopied = copiedId === item.id;
              const dateStr = new Date(item.timestamp).toLocaleDateString(
                lang === 'ar' ? 'ar-EG' : 'en-US',
                { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
              );

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-2.5 group"
                >
                  {/* Item Header */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                        {getDomainLabel(item.domain)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800 font-mono">
                        {getDepthLabel(item.depth)}
                      </span>
                    </div>

                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
                      {dateStr}
                    </span>
                  </div>

                  {/* Raw input preview */}
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">
                    {item.rawInput}
                  </div>

                  {/* Output snippet */}
                  <div
                    dir="ltr"
                    className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 text-left"
                  >
                    {item.output.slice(0, 140)}...
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                    <button
                      type="button"
                      onClick={() => onReopenItem(item)}
                      className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      <span>{t.reopen}</span>
                      {lang === 'ar' ? (
                        <ArrowUpLeft className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyItem(item.id, item.output)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          isCopied
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        title={t.copy}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={t.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
