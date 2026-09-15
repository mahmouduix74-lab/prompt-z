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
export function prepareCharacterMarkup(markup: string, prefix: string): string {
  return markup.replace(/<\?xml[^>]*\?>\s*/, '').replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`);
}

interface CharacterProps {
  name: CharacterName;
  /** Id prefix; use a different one when the same character appears twice. */
  instance?: string;
  className?: string;
}

export const Character: React.FC<CharacterProps> = ({ name, instance = name, className = '' }) => {
  const html = useMemo(() => prepareCharacterMarkup(SOURCES[name], instance), [name, instance]);

  return (
    <div
      className={`pz-character pz-character--${name} ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
