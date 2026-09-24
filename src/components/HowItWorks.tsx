import React, { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Modal } from './Modal';
import { AppLang } from '../utils/i18n';
import { HOW_IT_WORKS_VIDEO_URL } from '../constants';

/** A YouTube watch, share or embed link as an embed URL, or null when it is not one. */
function youTubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
}

const STEPS = {
  ar: [
    { title: 'اكتب فكرتك', body: 'بالعامية أو الفصحى أو الإنجليزية، ولو كانت فكرة بسيطة.' },
    { title: 'اختر المجال ومستوى التفصيل', body: 'ولغة البرومبت، واكتب ما لا تريده إن وجد.' },
    { title: 'انسخ البرومبت واستخدمه', body: 'برومبت منظم وجاهز لأي أداة ذكاء اصطناعي.' },
  ],
  en: [
    { title: 'Write your idea', body: 'In Arabic or English, even if it is rough.' },
    { title: 'Pick a domain and depth', body: 'Choose the prompt language, and note what you do not want.' },
    { title: 'Copy and use the prompt', body: 'A structured prompt, ready for any AI tool.' },
  ],
};

interface HowItWorksProps {
  lang: AppLang;
  onStart?: () => void;
}

/** "How it works" button under the hero text, opening the video (once set) and three steps. */
export const HowItWorks: React.FC<HowItWorksProps> = ({ lang, onStart }) => {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const embed = youTubeEmbed(HOW_IT_WORKS_VIDEO_URL);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group mt-5 sm:mt-6 inline-flex items-center gap-2.5 h-11 ps-2 pe-5 rounded-full text-sm font-semibold text-zinc-800 dark:text-zinc-100 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-700/70 shadow-sm hover:border-purple-400 dark:hover:border-purple-500 transition-colors duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 ${
          isAr ? 'font-arabic' : ''
        }`}
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white transition-transform duration-200 group-hover:scale-110">
          <Play className="w-3.5 h-3.5 fill-current ms-0.5" />
        </span>
        {isAr ? 'كيف يعمل؟' : 'How it works'}
      </button>

      <Modal open={open} lang={lang} labelledBy="how-title" onClose={() => setOpen(false)} size="lg">
        <h2 id="how-title" className="text-xl font-bold pe-8 text-start">
          {isAr ? 'كيف يعمل PromptZ؟' : 'How PromptZ works'}
        </h2>

        {embed && (
          <div className="mt-5 aspect-video w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <iframe
              src={embed}
              title={isAr ? 'فيديو: كيف يعمل PromptZ' : 'Video: how PromptZ works'}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <ol className="mt-5 flex flex-col gap-3 text-start">
          {STEPS[lang].map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-sm font-bold">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          data-autofocus
          onClick={() => {
            setOpen(false);
            onStart?.();
          }}
          className="group mt-6 flex items-center justify-center gap-2 w-full h-12 rounded-2xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {isAr ? 'ابدأ الآن' : 'Start now'}
          <ArrowRight className="w-4 h-4 rtl:-scale-x-100 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </button>
      </Modal>
    </>
  );
};
