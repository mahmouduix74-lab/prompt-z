import React from 'react';
import { Character, CharacterName } from './Character';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import '../styles/characters.css';

type LabelKey = 'charactersCreate' | 'charactersCustomize' | 'charactersExplore' | 'charactersOrganize';

// Labels come from the SVG titles ("PromptZ — Create", ...).
const ITEMS: Array<{ name: CharacterName; labelKey: LabelKey }> = [
  { name: 'create', labelKey: 'charactersCreate' },
  { name: 'customize', labelKey: 'charactersCustomize' },
  { name: 'explore', labelKey: 'charactersExplore' },
  { name: 'organize', labelKey: 'charactersOrganize' },
];

export const CharactersSection: React.FC<{ lang: AppLang }> = ({ lang }) => {
  const t = UI_STRINGS[lang];

  return (
    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
      {ITEMS.map((item, index) => (
        <li key={item.name} className="flex flex-col items-center gap-3">
          {/* White tile: the line art is dark, so it needs a light ground in both themes */}
          <div
            className="pz-tile w-full max-w-[220px] aspect-square rounded-3xl bg-white border border-zinc-200/80 dark:border-white/10 shadow-sm p-3 sm:p-4"
            style={{ '--pz-delay': `${index * -0.7}s` } as React.CSSProperties}
          >
            <Character name={item.name} />
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t[item.labelKey]}</span>
        </li>
      ))}
    </ul>
  );
};
