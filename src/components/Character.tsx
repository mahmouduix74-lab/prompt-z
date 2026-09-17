import React, { useMemo } from 'react';
import '../styles/characters.css';
import createSvg from '../assets/characters/create-character.svg?raw';
import customizeSvg from '../assets/characters/customize-character.svg?raw';
import exploreSvg from '../assets/characters/explore-character.svg?raw';
import organizeSvg from '../assets/characters/organize-character.svg?raw';

export type CharacterName = 'create' | 'customize' | 'explore' | 'organize';

const SOURCES: Record<CharacterName, string> = {
  create: createSvg,
  customize: customizeSvg,
  explore: exploreSvg,
  organize: organizeSvg,
};

/**
 * Inlines the original PromptZ SVG so CSS can animate its named parts.
 * The drawing itself is untouched (paths, colours, transforms). Only two things
 * differ from the file: the XML declaration is dropped (not valid inside HTML),
 * and every id gets a per-instance prefix so several drawings can share a page.
 */
export function prepareCharacterMarkup(
  markup: string,
  prefix: string,
  name?: CharacterName,
  bodyOnly?: boolean
): string {
  let cleaned = markup
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`);

  if (name === 'create' && bodyOnly) {
    // Remove the Light-bulb and Idea-rays groups for clean companion cursor
    cleaned = cleaned.replace(/<g id="[^"]*-Light-bulb">[\s\S]*?<\/g>/, '');
    cleaned = cleaned.replace(/<g id="[^"]*-Idea-rays">[\s\S]*?<\/g>/, '');
  }

  if (name === 'create') {
    // Inject a silhouette filled body element behind the line art for solid fill
    const bodySilhouette = `<path id="${prefix}-Body-fill" class="pz-character-body-fill" d="M 1309 253 C 1312 226 1328 192 1354 180 C 1382 168 1405 181 1409 244 C 1424 231 1429 208 1440 209 C 1457 209 1459 235 1446 260 C 1439 274 1427 287 1417 294 C 1400 310 1375 328 1348 330 C 1318 330 1301 315 1308 300 C 1310 280 1318 258 1309 253 Z" />`;
    cleaned = cleaned.replace(/(<g id="[^"]*-Character">)/, `$1${bodySilhouette}`);
  }

  if (name === 'explore') {
    // Inject a silhouette filled body element for explore (magnifying glass search mascot)
    const exploreSilhouette = `<path id="${prefix}-Explore-body-fill" class="pz-character-body-fill" d="M 823 244 C 825 218 839 194 861 186 C 879 179 892 182 901 190 C 915 205 918 230 918 260 C 917 280 920 305 921 329 C 880 330 830 330 789 323 C 794 293 811 266 827 250 Z" />`;
    cleaned = cleaned.replace(/(<g id="[^"]*-Character">)/, `$1${exploreSilhouette}`);
  }

  if (name === 'organize') {
    // Inject a silhouette filled body element for organize (document/notes mascot)
    const organizeSilhouette = `<path id="${prefix}-Organize-body-fill" class="pz-character-body-fill" d="M 1043 319 C 1043 300 1048 281 1052 269 C 1041 252 1044 229 1058 213 C 1071 198 1088 191 1101 196 C 1112 200 1119 212 1122 226 C 1125 240 1123 260 1120 280 C 1116 300 1080 320 1043 319 Z" />`;
    cleaned = cleaned.replace(/(<g id="[^"]*-Character">)/, `$1${organizeSilhouette}`);
  }

  return cleaned;
}

interface CharacterProps {
  name: CharacterName;
  /** Id prefix; use a different one when the same character appears twice. */
  instance?: string;
  className?: string;
  /** When true, renders only the Character body, omitting accessories */
  bodyOnly?: boolean;
  /** When true, flips the character horizontally so it faces left instead of right */
  flip?: boolean;
}

export const Character: React.FC<CharacterProps> = ({
  name,
  instance = name,
  className = '',
  bodyOnly = false,
  flip = false,
}) => {
  const html = useMemo(() => prepareCharacterMarkup(SOURCES[name], instance, name, bodyOnly), [name, instance, bodyOnly]);

  return (
    <div
      className={`pz-character pz-character--${name} ${className}`}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
