/**
 * Offline "Enhance", used when the model is unavailable. It only tidies the user's own
 * text (spacing, repeated words, punctuation) and never adds content, so the result
 * says exactly what the user wrote.
 */

export interface RefineOptions {
  rawText: string;
  domain?: string;
}

export function refineLocalPromptText(options: RefineOptions | string): string {
  const raw = typeof options === 'string' ? options : options.rawText;
  const text = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]+/g, ' ')
        // The same word typed twice in a row ("the the", "في في").
        .replace(/(^|\s)(\S+)(\s+\2)+(?=\s|$)/gu, '$1$2')
        // No space before punctuation, one space after it.
        .replace(/\s+([,.;:!?،؛؟])/g, '$1')
        .replace(/([,;:!?،؛؟])(?=[^\s\d])/g, '$1 ')
        .trim()
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  const isArabic = /[؀-ۿ]/.test(text);
  const tidied = isArabic ? text : text.charAt(0).toUpperCase() + text.slice(1);
  // End a single-paragraph request with a full stop; leave lists and existing punctuation alone.
  const endsCleanly = /[.!?؟…:)\]]$/.test(tidied) || tidied.includes('\n');
  return endsCleanly ? tidied : `${tidied}.`;
}
