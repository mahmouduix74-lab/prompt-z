import React, { useEffect, useState } from 'react';

/**
 * The classic page's hero title in black and white: a fixed prefix, a word that types itself,
 * deletes and moves to the next, and an optional suffix. Screen readers get the first word as
 * plain text; with reduced motion the first word just stays.
 */
export const TypingTitle: React.FC<{
  prefix: string;
  words: readonly string[];
  suffix?: string;
  still?: boolean;
}> = ({ prefix, words, suffix = '', still = false }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [length, setLength] = useState(still ? Array.from(words[0] || '').length : 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setWordIndex(0);
    setLength(still ? Array.from(words[0] || '').length : 0);
    setDeleting(false);
  }, [words, still]);

  useEffect(() => {
    if (still || !words.length) return;
    const full = Array.from(words[wordIndex % words.length]).length;
    if (!deleting && length === full) {
      const t = setTimeout(() => setDeleting(true), 1900);
      return () => clearTimeout(t);
    }
    if (deleting && length === 0) {
      setDeleting(false);
      setWordIndex((i) => (i + 1) % words.length);
      return;
    }
    const t = setTimeout(() => setLength((n) => n + (deleting ? -1 : 1)), deleting ? 45 : 110);
    return () => clearTimeout(t);
  }, [length, deleting, wordIndex, words, still]);

  const word = Array.from(words[wordIndex % words.length] || '').slice(0, length).join('');

  return (
    <>
      <span className="sr-only">{[prefix, words[0], suffix].filter(Boolean).join(' ')}</span>
      <span aria-hidden="true" className="inline-flex flex-wrap items-center justify-center gap-x-[0.25em]">
        <span>{prefix}</span>
        <span className="inline-flex items-center text-zinc-500 dark:text-zinc-400">
          {word}
          <span className="inline-block w-[3px] h-[0.85em] ms-1 rounded-full bg-zinc-900 dark:bg-white animate-pulse" />
        </span>
        {suffix && <span>{suffix}</span>}
      </span>
    </>
  );
};
