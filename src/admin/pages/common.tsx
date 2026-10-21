/** What every dashboard page gets, and the controls several pages share. */
import { DownloadCloud02 } from '@untitledui/icons';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import type { Row, Stats } from '../api';
import { dayLabel, daysBetween } from '../format';

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

/** Hours in the viewer's time zone, from the server's UTC hours. */
export function localHours(rows: { hour: number; n: number }[]): { label: string; value: number }[] {
  const shift = Math.round(-new Date().getTimezoneOffset() / 60);
  const out = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: 0 }));
  for (const r of rows) out[(((r.hour + shift) % 24) + 24) % 24].value += r.n;
  return out;
}
