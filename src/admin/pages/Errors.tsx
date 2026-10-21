import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell01, XCircle } from '@untitledui/icons';
import { Button } from '../ds/components/base/buttons/button';
import { PaginationCardMinimal } from '../ds/components/application/pagination/pagination';
import { Table, TableCard } from '../ds/components/application/table/table';
import { BadgeWithIcon } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { api, type Row } from '../api';
import { Bars } from '../charts';
import { ago, countryLabel, fmt, percent } from '../format';
import { Card, Empty, Grid, MetricItem, PageHeader } from '../ui';
import { periodName, RangePicker, type PageProps } from './common';

const TYPES: Record<string, { label: string; color: 'warning' | 'error' | 'brand' | 'gray'; icon: typeof XCircle }> = {
  busy: { label: 'الموديل مشغول', color: 'warning', icon: AlertTriangle },
  down: { label: 'الموديل مش متاح', color: 'error', icon: XCircle },
  brief: { label: 'رد مش مفهوم', color: 'brand', icon: AlertTriangle },
  long: { label: 'الطلب طويل', color: 'gray', icon: AlertCircle },
  other: { label: 'خطأ تاني', color: 'gray', icon: AlertCircle },
};
const typeOf = (r: Row) => TYPES[r.error] || TYPES.other;
const PAGE_SIZE = 10;

/** OpenRouter's message, or the length check in words. */
function detailText(r: Row): string {
  const long = /^(\d+) > (\d+)$/.exec(r.detail || '');
  if (long) return `الطلب ${fmt(Number(long[1]))} حرف، والحد ${fmt(Number(long[2]))}`;
  return r.detail || '—';
}

export function Errors({ stats, days, setDays, navigate }: PageProps) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [models, setModels] = useState<{ model: string; available: boolean }[] | null>(null);
  useEffect(() => {
    api.models().then((r) => setModels(r.models), () => setModels([]));
  }, []);
  useEffect(() => setPage(1), [filter]);

  const failed24 = stats.last24.reduce((s, h) => s + (Number(h.errors) || 0), 0);
  const calls24 = stats.last24.reduce((s, h) => s + (Number(h.calls) || 0), 0);
  const top = stats.errorTypes[0];
  const down = models?.filter((m) => !m.available) || [];
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const ago = 23 - i;
    const row = stats.last24.find((h) => h.ago === ago);
    return { label: ago === 0 ? 'دلوقتي' : ago % 6 === 0 ? `قبل ${ago} س` : '', value: Number(row?.errors) || 0 };
  });
  const hourlyRate = Array.from({ length: 24 }, (_, i) => {
    const row = stats.last24.find((h) => h.ago === 23 - i);
    return row?.calls ? (Number(row.errors) / Number(row.calls)) * 100 : 0;
  });
  const worst = hourly.reduce((best, h, i) => (h.value > hourly[best].value ? i : best), 0);

  const rows = useMemo(() => stats.errors.filter((r) => filter === 'all' || (r.error || 'other') === filter), [stats.errors, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const present = Object.keys(TYPES).filter((k) => stats.errors.some((r) => (r.error || 'other') === k));

  return (
    <>
      <PageHeader title="سجل الأخطاء" description="كل طلب فشل، وسببه" actions={
          <Button color="secondary" size="md" iconLeading={Bell01} onClick={() => navigate('/admin/alerts')}>
            تنبيهات الأخطاء
          </Button>
        }
      />
      <RangePicker days={days} setDays={setDays} />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="فشل آخر 24 ساعة" value={fmt(failed24)} note={`من ${fmt(calls24)} طلب`} data={hourly.map((h) => h.value)} chartTone={failed24 ? 'error' : 'success'} />
        <MetricItem title="نسبة الفشل" value={calls24 ? percent(failed24, calls24, 1) : '—'} note={'حد التنبيه: \u206610%\u2069'} data={hourlyRate} chartTone={calls24 && failed24 / calls24 > 0.1 ? 'error' : 'success'} />
        <MetricItem textValue title="أكتر سبب" value={top ? TYPES[top.key]?.label || top.key : '—'} note={top ? `${fmt(top.n)} من ${fmt(failed24)}` : 'مافيش أخطاء'} />
        <MetricItem
          textValue
          title="حالة الموديلات"
          value={!models ? '…' : down.length ? 'فيه مشكلة' : models.length ? 'شغالة' : '—'}
          note={!models ? undefined : down.length ? `${down.length} مش متاح: ${down.map((m) => m.model.split('/')[1]).join('، ')}` : 'كل الموديلات متاحة'}
        />
      </Grid>
      <Card title="الفشل في كل ساعة" description="آخر 24 ساعة">
        {failed24 ? (
          <Bars data={hourly} className="text-utility-red-300" highlightClass="text-utility-red-600" highlight={worst} name="فشل" height="h-48" />
        ) : (
          <Empty title="مافيش أخطاء في آخر 24 ساعة" />
        )}
      </Card>
      <TableCard.Root>
        <TableCard.Header
          title="آخر الأخطاء"
          badge={fmt(rows.length)}
          description={periodName(days)}
          contentTrailing={
            present.length > 1 ? (
              <ButtonGroup
                size="sm"
                selectedKeys={[filter]}
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const [key] = [...keys];
                  if (key) setFilter(String(key));
                }}
              >
                <ButtonGroupItem id="all">الكل</ButtonGroupItem>
                {present.map((k) => (
                  <ButtonGroupItem key={k} id={k}>
                    {TYPES[k].label}
                  </ButtonGroupItem>
                ))}
              </ButtonGroup>
            ) : undefined
          }
        />
        {rows.length ? (
          <>
            <Table aria-label="الأخطاء">
              <Table.Header>
                <Table.Head id="t" label="النوع" isRowHeader />
                <Table.Head id="d" label="التفاصيل" className="w-full" />
                <Table.Head id="m" label="الموديل" />
                <Table.Head id="u" label="مين" />
                <Table.Head id="w" label="إمتى" />
                <Table.Head id="c" label="اتكرر" />
              </Table.Header>
              <Table.Body items={visible.map((r, i) => ({ ...r, id: `${r.ts}-${i}` }) as Row)}>
                {(r) => {
                  const type = typeOf(r);
                  return (
                    <Table.Row id={r.id}>
                      <Table.Cell>
                        <BadgeWithIcon size="sm" type="modern" color={type.color} iconLeading={type.icon}>
                          {type.label}
                        </BadgeWithIcon>
                      </Table.Cell>
                      <Table.Cell className="text-secondary">
                        <span className="line-clamp-2" dir="auto">
                          {detailText(r)}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="font-mono whitespace-nowrap" dir="ltr">
                        {r.model ? String(r.model).split('/').pop() : '—'}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap" dir="auto">
                        {r.account || (r.country ? `زائر من ${countryLabel(r.country).split(' ').slice(1).join(' ')}` : 'زائر')}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">{ago(r.ts)}</Table.Cell>
                      <Table.Cell className="font-medium text-primary" dir="ltr">
                        ×{r.times}
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table>
            {pages > 1 && <PaginationCardMinimal page={page} total={pages} align="left" onPageChange={(p) => setPage(Math.max(1, Math.min(pages, p)))} />}
          </>
        ) : (
          <Empty title="مافيش أخطاء في الفترة دي" />
        )}
      </TableCard.Root>
    </>
  );
}
