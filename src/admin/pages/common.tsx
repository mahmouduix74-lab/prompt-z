/** What every dashboard page gets, and the controls several pages share. */
import { DownloadCloud02 } from '@untitledui/icons';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import type { Row, Stats } from '../api';
import { countryLabel, dayLabel, daysBetween, domainLabel, initials } from '../format';

export interface PageProps {
  stats: Stats;
  days: number;
  setDays: (days: number) => void;
  navigate: (href: string) => void;
  reload: () => Promise<void>;
  query: URLSearchParams;
}

const RANGES = [
  { id: '1', label: 'النهارده' },
  { id: '7', label: '7 أيام' },
  { id: '30', label: '30 يوم' },
  { id: '90', label: '90 يوم' },
];

/** The DS button group that picks the period every page shows. */
export const RangePicker = ({ days, setDays, size = 'md' }: { days: number; setDays: (d: number) => void; size?: 'sm' | 'md' }) => (
  <ButtonGroup
    size={size}
    selectedKeys={[String(days)]}
    disallowEmptySelection
    onSelectionChange={(keys) => {
      const [key] = [...keys];
      if (key) setDays(Number(key));
    }}
  >
    {RANGES.map((r) => (
      <ButtonGroupItem key={r.id} id={r.id}>
        {r.label}
      </ButtonGroupItem>
    ))}
  </ButtonGroup>
);

export const ExportButton = ({ onPress, label = 'تصدير' }: { onPress: () => void; label?: string }) => (
  <Button color="secondary" size="md" iconLeading={DownloadCloud02} onClick={onPress}>
    {label}
  </Button>
);

/** "آخر 30 يوم" / "النهارده". */
export const periodName = (days: number) => (days === 1 ? 'النهارده' : `آخر ${days} ${days > 10 ? 'يوم' : 'أيام'}`);
export const prevName = (days: number) => (days === 1 ? 'إمبارح' : `الـ ${days} ${days > 10 ? 'يوم' : 'أيام'} اللي قبلهم`);

/**
 * One row per day of the period, with `now` from this period and `prev` from the same day of the
 * previous one, for TrendChart.
 */
export function compareSeries(stats: Stats, rows: Row[], key: string): { label: string; now: number; prev: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r[key]) || 0]));
  const now = daysBetween(stats.range.start, stats.range.end);
  const prev = daysBetween(stats.range.prevStart, stats.range.prevEnd);
  return now.map((day, i) => ({ label: dayLabel(day), now: byDay.get(day) || 0, prev: byDay.get(prev[i]) || 0 }));
}

/** The period's daily values for a mini chart. */
export const spark = (stats: Stats, rows: Row[], key: string) => compareSeries(stats, rows, key).map((d) => d.now);

/** Prompts per weekday (0 = Sunday) and hour in the viewer's time zone, from the server's UTC counts. */
export function localWeekHours(rows: { dow: number; hour: number; n: number }[]): number[][] {
  const shift = Math.round(-new Date().getTimezoneOffset() / 60);
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of rows) {
    const at = (((r.dow * 24 + r.hour + shift) % 168) + 168) % 168;
    grid[Math.floor(at / 24)][at % 24] += r.n;
  }
  return grid;
}

/** One line of the activity feed: who did what. */
export function describe(r: Row): { name: string; text: string; highlight?: string; initial: string } {
  const who = r.account || (r.country ? `زائر من ${countryLabel(r.country).split(' ').slice(1).join(' ')}` : 'زائر');
  const initial = r.account ? initials(r.account) : 'ز';
  if (r.kind === 'signup') return { name: who, text: 'سجّل حساب جديد بـ', highlight: r.domain === 'email' ? 'الإيميل' : 'Google', initial };
  if (r.kind === 'feedback') return { name: who, text: 'قيّم برومبت', highlight: r.rating === 'up' ? '👍' : '👎', initial };
  const area = r.domain ? domainLabel(r.domain) : undefined;
  if (r.kind === 'refine') return { name: who, text: r.outcome === 'ok' ? 'حسّن صياغة طلب في' : 'حاول يحسّن صياغة طلب في', highlight: area, initial };
  const text =
    r.outcome === 'ok'
      ? 'عمل برومبت في'
      : r.outcome === 'clarify'
        ? 'اتسأل أسئلة توضيحية في'
        : r.outcome === 'limit'
          ? 'وصل للحد اليومي في'
          : 'طلبه فشل في';
  return { name: who, text, highlight: area, initial };
}

/** The share of calls that worked, each day of the period (0–100). */
export function successSeries(stats: Stats): number[] {
  const byDay = new Map(stats.daily.map((r) => [r.day, r]));
  return daysBetween(stats.range.start, stats.range.end).map((day) => {
    const ok = Number(byDay.get(day)?.prompts) || 0;
    const failed = Number(byDay.get(day)?.errors) || 0;
    return ok + failed ? (ok / (ok + failed)) * 100 : 100;
  });
}

/** The share of 👍 ratings up to each day of the period (0–100), so quiet days keep the last value. */
export function satisfactionSeries(stats: Stats): number[] {
  const ratings = new Map<string, { up: number; n: number }>();
  for (const f of stats.feedback.recent) {
    const day = String(f.created_at).slice(0, 10);
    const d = ratings.get(day) || { up: 0, n: 0 };
    d.n++;
    if (f.rating === 'up') d.up++;
    ratings.set(day, d);
  }
  let up = 0;
  let n = 0;
  return daysBetween(stats.range.start, stats.range.end).map((day) => {
    const d = ratings.get(day);
    if (d) {
      up += d.up;
      n += d.n;
    }
    return n ? (up / n) * 100 : 0;
  });
}

/** A running total, for counts that only grow (accounts). */
export const cumulative = (values: number[]) => {
  let total = 0;
  return values.map((v) => (total += v));
};

/** The success rate of a period's calls (0–1). */
export const successRate = (t: { calls: number; errors: number }) => (t.calls ? (t.calls - t.errors) / t.calls : 0);
