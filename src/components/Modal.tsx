import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { AppLang } from '../utils/i18n';

/** Soft ease-out used for menus and dialogs. */
export const EASE = [0.22, 1, 0.36, 1] as const;

interface ModalProps {
  open: boolean;
  lang: AppLang;
  /** id of the element that names the dialog (its title). */
  labelledBy: string;
  onClose: () => void;
  /** Wider dialogs for forms. */
  size?: 'sm' | 'md' | 'lg';
  /** 'solid' hides the page behind completely instead of dimming it. */
  backdrop?: 'dim' | 'solid';
  children: React.ReactNode;
}

/**
 * The site's popup: dimmed backdrop, centered card, Esc and backdrop click to close, focus moved
 * into the dialog on open and back to where it was on close.
 */
export const Modal: React.FC<ModalProps> = ({ open, lang, labelledBy, onClose, size = 'sm', backdrop = 'dim', children }) => {
  const isAr = lang === 'ar';
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const first = cardRef.current?.querySelector<HTMLElement>('[data-autofocus], button:not([aria-label]), a, input');
      first?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  // Rendered at the end of <body> so no section's stacking (the hero, the sticky header) sits above it.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
            backdrop === 'solid' ? 'bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-2xl' : 'bg-zinc-950/50 backdrop-blur-sm'
          }`}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            dir={isAr ? 'rtl' : 'ltr'}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={`relative w-full ${size === 'lg' ? 'max-w-[640px]' : size === 'md' ? 'max-w-[480px]' : 'max-w-[400px]'} max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xl shadow-purple-950/20 p-7 sm:p-8 text-zinc-900 dark:text-zinc-100 ${isAr ? 'font-arabic' : ''}`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 inline-flex items-center justify-center w-9 h-9 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <X className="w-4 h-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
