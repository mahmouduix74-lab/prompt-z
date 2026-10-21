/** Labels and number formats for the admin dashboard (Arabic, Latin digits). */
import { DEPTHS, DOMAINS, OUTPUT_LANGUAGES } from '../constants';

export const LOCALE = 'ar-EG-u-nu-latn';

const numbers = new Intl.NumberFormat('en-US');
export const fmt = (n: number | null | undefined) => numbers.format(Math.round(Number(n) || 0));
export const fmt1 = (n: number) => (Number.isInteger(n) ? fmt(n) : n.toFixed(1));
export const percent = (part: number, whole: number, digits = 0) => (whole ? `${((part / whole) * 100).toFixed(digits)}%` : '—');

/** Dollars: cents for amounts from a dime up, more digits for the tiny per-prompt costs. */
export function money(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (n === 0) return '$0';
  if (Math.abs(n) >= 0.1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(n >= 0.001 ? 3 : 4)}`;
}

export const seconds = (ms: number | null | undefined) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);

/** The change from `before` to `now`, as MetricItem shows it. */
export function change(now: number, before: number, { lowerIsBetter = false } = {}) {
  if (!before) return {};
  const diff = ((now - before) / before) * 100;
  if (Math.abs(diff) < 0.5) return {};
  const trend: 'up' | 'down' = diff >= 0 ? 'up' : 'down';
  return { change: `${Math.abs(diff).toFixed(Math.abs(diff) < 10 ? 1 : 0)}%`, trend, good: lowerIsBetter ? trend === 'down' : trend === 'up' };
}

export const domainLabel = (id: string) => DOMAINS.find((d) => d.id === id)?.labelAr || id || 'غير محدد';
export const depthLabel = (id: string) => DEPTHS.find((d) => d.id === id)?.labelAr || id || 'غير محدد';
export const languageLabel = (id: string) => OUTPUT_LANGUAGES.find((l) => l.id === id)?.labelAr || id || 'غير محدد';

export const DEVICE_LABELS: Record<string, string> = { mobile: 'موبايل', desktop: 'كمبيوتر', tablet: 'تابلت', bot: 'بوت' };

export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'انستجرام',
  facebook: 'فيسبوك',
  linkedin: 'لينكدإن',
  x: 'إكس (تويتر)',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  whatsapp: 'واتساب',
  telegram: 'تليجرام',
  google: 'جوجل',
  direct: 'دخول مباشر',
  other: 'مواقع تانية',
};
export const sourceLabel = (key: string) => SOURCE_LABELS[key] || key;

/** Platforms a campaign link can be made for (src/server/visits.ts). */
export const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'whatsapp', 'telegram', 'other'] as const;

let regions: Intl.DisplayNames | null = null;
try {
  regions = new Intl.DisplayNames(['ar'], { type: 'region' });
} catch {
  regions = null;
}

/** "🇪🇬 مصر" from "EG". */
export function countryLabel(code: string): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return 'غير معروف';
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  return `${flag} ${regions?.of(code) || code}`;
}

/** "22 سبتمبر" from "2026-09-22". */
export const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "21 أكتوبر 2026" from an ISO time. */
export const dateLabel = (ts: string | null | undefined) =>
  ts ? new Date(ts.length === 10 ? `${ts}T00:00:00Z` : ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** "دلوقتي", "5 د", "3 س", "أمس", "منذ 4 أيام". */
export function ago(ts: string | null | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const minutes = Math.floor((now - Date.parse(ts.length === 10 ? `${ts}T12:00:00Z` : ts)) / 60_000);
  if (minutes < 1) return 'دلوقتي';
  if (minutes < 60) return `${minutes} د`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} س`;
  const days = Math.floor(minutes / (24 * 60));
  if (days === 1) return 'أمس';
  return `منذ ${days} ${days <= 10 ? 'أيام' : 'يوم'}`;
}

/** Every day from `start` to `end` (YYYY-MM-DD, inclusive). */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Downloads rows as a CSV file Excel opens with the right encoding. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const initials = (name: string) => (name || '?').trim().charAt(0).toUpperCase();
