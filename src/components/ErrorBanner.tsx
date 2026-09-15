import React from 'react';
import { GenerationErrorDetails } from '../types';
import { AlertTriangle, Clock, X, RefreshCw, ShieldAlert, Zap, HelpCircle } from 'lucide-react';

interface ErrorBannerProps {
  error: GenerationErrorDetails | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onDismiss,
  onRetry,
}) => {
  if (!error) return null;

  const isUnclassified429 =
    error.statusCode === 429 && !error.isRateLimitMinute && !error.isDailyQuotaExhausted;

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-xs text-rose-200 shadow-lg backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="space-y-2">
            {/* Header: Status Code & Classification Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-rose-300">
                {error.statusCode
                  ? `خطأ من Google API (HTTP ${error.statusCode})`
                  : 'خطأ أثناء تنفيذ الطلب'}
              </span>

              {/* Per-minute Rate Limit vs Daily Quota Exhaustion tags */}
              {error.isRateLimitMinute && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" />
                  تجاوز حد الطلبات للدقيقة (Per-Minute Rate Limit)
                </span>
              )}

              {error.isDailyQuotaExhausted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Zap className="w-3 h-3" />
                  استنفاد الحصة اليومية (Daily Quota Exhaustion)
                </span>
              )}

              {isUnclassified429 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <HelpCircle className="w-3 h-3" />
                  نوع الحد غير محدد في رد Google
                </span>
              )}

              {typeof error.retryDelaySeconds === 'number' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <Clock className="w-3 h-3 text-amber-400" />
                  retryDelay: {error.retryDelaySeconds}s
                </span>
              )}

              {/* Finish Reason tag if empty response */}
              {error.finishReason && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  finishReason: {error.finishReason}
                </span>
              )}
            </div>

            {/* Actual Raw Message from Google */}
            <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-rose-900/40 font-mono text-[11px] text-rose-300/90 whitespace-pre-wrap break-all select-text" dir="ltr">
              {error.rawMessage}
            </div>

            {/* Helpful guidance */}
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {error.userGuidance ? (
                <>
                  💡 <strong className="text-zinc-200">إرشاد: </strong>
                  {error.userGuidance}
                </>
              ) : error.statusCode === 400 ? (
                'Google رفض الطلب (HTTP 400). راجع الرسالة أعلاه والنموذج المختار.'
              ) : error.statusCode === 401 || error.statusCode === 403 ? (
                'Google رفض مفتاح السيرفر GEMINI_API_KEY. راجع Secrets في AI Studio.'
              ) : (
                'راجع الرسالة أعلاه ثم حاول مرة أخرى.'
              )}
            </p>
          </div>
        </div>

        {/* Action buttons: Retry & Close */}
        <div className="flex items-center gap-1 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900/50 transition-colors cursor-pointer"
              title="إعادة المحاولة"
              aria-label="إعادة المحاولة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-900/50 transition-colors cursor-pointer"
            title="إغلاق التنبيه"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
