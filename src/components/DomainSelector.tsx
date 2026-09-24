import React from 'react';
import { motion } from 'motion/react';
import { DomainType } from '../types';
import { DOMAINS } from '../constants';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import {
  Layers,
  Layout,
  Code2,
  Server,
  FileSearch,
  PenTool,
  Image as ImageIcon,
  Smartphone,
  CloudCog,
  BarChart3,
  Brain,
  Target,
  Megaphone,
  Palette,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

interface DomainSelectorProps {
  selectedDomain: DomainType;
  onSelectDomain: (domain: DomainType) => void;
  disabled?: boolean;
  lang: AppLang;
}

const domainIcons: Record<DomainType, React.ReactNode> = {
  general: <Layers className="w-3.5 h-3.5" />,
  ui_ux: <Layout className="w-3.5 h-3.5" />,
  frontend: <Code2 className="w-3.5 h-3.5" />,
  backend: <Server className="w-3.5 h-3.5" />,
  research: <FileSearch className="w-3.5 h-3.5" />,
  content: <PenTool className="w-3.5 h-3.5" />,
  media: <ImageIcon className="w-3.5 h-3.5" />,
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  devops: <CloudCog className="w-3.5 h-3.5" />,
  data: <BarChart3 className="w-3.5 h-3.5" />,
  ai_ml: <Brain className="w-3.5 h-3.5" />,
  product: <Target className="w-3.5 h-3.5" />,
  marketing: <Megaphone className="w-3.5 h-3.5" />,
  graphic: <Palette className="w-3.5 h-3.5" />,
  education: <GraduationCap className="w-3.5 h-3.5" />,
  business: <Briefcase className="w-3.5 h-3.5" />,
};

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  selectedDomain,
  onSelectDomain,
  disabled,
  lang,
}) => {
  const t = UI_STRINGS[lang];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between h-6 text-sm px-0.5">
        <span className="text-zinc-900 dark:text-zinc-50 font-bold">{t.domainLabel}</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1 scrollbar-none no-scrollbar">
        {DOMAINS.map((domain) => {
          const isSelected = selectedDomain === domain.id;
          return (
            <motion.button
              key={domain.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDomain(domain.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? 'text-white font-semibold'
                  : 'bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md hover:bg-white/90 dark:hover:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-white/80 dark:border-zinc-800/80 shadow-2xs'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="selected-domain-indicator"
                  className="absolute inset-0 bg-purple-600 rounded-xl shadow-xs border border-purple-500/40 -z-10"
                  transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
                />
              )}
              <span className={`relative z-10 ${isSelected ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {domainIcons[domain.id]}
              </span>
              <span className="relative z-10">{lang === 'ar' ? domain.labelAr : domain.labelEn}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
