import React, { useMemo } from 'react';
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
  let cleaned = markup.replace(/<\?xml[^>]*\?>\s*/, '').replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`);

  if (name === 'create' && bodyOnly) {
    // Remove the Light-bulb and Idea-rays groups completely
    cleaned = cleaned.replace(/<g id="[^"]*-Light-bulb">[\s\S]*?<\/g>/, '');
    cleaned = cleaned.replace(/<g id="[^"]*-Idea-rays">[\s\S]*?<\/g>/, '');
  }

  if (name === 'create') {
    // Inject a silhouette filled body element behind the line art
    const bodySilhouette = `<path id="${prefix}-Body-fill" class="pz-character-body-fill" d="M 1309 253 C 1312 226 1328 192 1354 180 C 1382 168 1405 181 1409 244 C 1424 231 1429 208 1440 209 C 1457 209 1459 235 1446 260 C 1439 274 1427 287 1417 294 C 1400 310 1375 328 1348 330 C 1318 330 1301 315 1308 300 C 1310 280 1318 258 1309 253 Z" />`;
    cleaned = cleaned.replace(/(<g id="[^"]*-Character">)/, `$1${bodySilhouette}`);
  }
  return cleaned;
}

interface CharacterProps {
  name: CharacterName;
  /** Id prefix; use a different one when the same character appears twice. */
  instance?: string;
  className?: string;
  /** When true, renders only the Character body, omitting accessories like lightbulb & rays */
  bodyOnly?: boolean;
}

export const Character: React.FC<CharacterProps> = ({ name, instance = name, className = '', bodyOnly = false }) => {
  const html = useMemo(() => prepareCharacterMarkup(SOURCES[name], instance, name, bodyOnly), [name, instance, bodyOnly]);

  return (
    <div
      className={`pz-character pz-character--${name} ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
