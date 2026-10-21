import { useState } from 'react';
import { ArrowUpRight } from '@untitledui/icons';
import { Tabs } from '../ds/components/application/tabs/tabs';
import { Avatar } from '../ds/components/base/avatar/avatar';
import { BadgeWithDot } from '../ds/components/base/badges/badges';
import { Bars, TrendChart } from '../charts';
import { ago, change, countryLabel, domainLabel, downloadCsv, fmt, initials, percent, sourceLabel } from '../format';
import { BarList, BarRow, Card, CardMenu, Empty, FeedItem, Grid, MetricItem, PageHeader } from '../ui';
import type { Row } from '../api';
import { compareSeries, ExportButton, localHours, periodName, prevName, RangePicker, spark, type PageProps } from './common';

type Series = 'prompts' | 'people' | 'accounts' | 'enhanced';
const SERIES: { id: Series; label: string }[] = [
  { id: 'prompts', label: 'برومبتات' },
  { id: 'people', label: 'أشخاص' },
  { id: 'accounts', label: 'حسابات' },
  { id: 'enhanced', label: 'تحسين صياغة' },
];

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

export function Overview({ stats, days, setDays, navigate }: PageProps) {
  const [series, setSeries] = useState<Series>('prompts');
  const { period, prev } = stats;
  const rate = (t: { calls: number; errors: number }) => (t.calls ? (t.calls - t.errors) / t.calls : 0);
  const signups = stats.signups.map((r) => ({ day: r.day, n: r.n }));
  const hours = localHours(stats.hours);
  const peak = hours.reduce((best, h, i) => (h.value > hours[best].value ? i : best), 0);
  const name = SERIES.find((s) => s.id === series)!.label;
  const visitors = Math.max(period.visitors, period.people);

  const exportDaily = () =>
    downloadCsv(
      `promptz-${stats.range.start}-${stats.range.end}.csv`,
      ['day', 'prompts', 'people', 'accounts', 'enhanced', 'errors', 'cost_usd'],
      stats.daily.filter((r) => r.day >= stats.range.start).map((r) => [r.day, r.prompts, r.people, r.accounts, r.enhanced, r.errors, r.cost])
    );

  return (
    <>
      <PageHeader title="أهلًا بيك" description={`${periodName(days)}، والنسب مقارنة بـ${prevName(days)}.`} actions={<ExportButton onPress={exportDaily} />} />
      <RangePicker days={days} setDays={setDays} />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="برومبتات اتعملت" value={fmt(period.prompts)} {...change(period.prompts, prev.prompts)} data={spark(stats, stats.daily, 'prompts')} />
        <MetricItem title="أشخاص استخدموا الموقع" value={fmt(period.people)} {...change(period.people, prev.people)} data={spark(stats, stats.daily, 'people')} />
        <MetricItem
          title="حسابات جديدة"
          value={fmt(period.signups)}
          {...change(period.signups, prev.signups)}
          data={spark(stats, signups, 'n')}
          actions={[{ label: 'افتح المستخدمين', icon: ArrowUpRight, onAction: () => navigate('/admin/users') }]}
        />
        <MetricItem
          title="نسبة النجاح"
          value={period.calls ? percent(period.calls - period.errors, period.calls, 1) : '—'}
          {...change(rate(period), rate(prev))}
          actions={[{ label: 'افتح سجل الأخطاء', icon: ArrowUpRight, onAction: () => navigate('/admin/errors') }]}
        />
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={`${name} في اليوم`} description={`مقارنة بـ${prevName(days)}`} trailing={<CardMenu actions={[{ label: 'تصدير CSV', onAction: exportDaily }]} />}>
          <Tabs selectedKey={series} onSelectionChange={(k) => setSeries(k as Series)} className="mb-4">
            <Tabs.List type="button-gray" size="sm" items={SERIES}>
              {(t) => <Tabs.Item {...t} />}
            </Tabs.List>
          </Tabs>
          <TrendChart
            data={series === 'accounts' ? compareSeries(stats, signups, 'n') : compareSeries(stats, stats.daily, series)}
            series={[
              { key: 'now', name: periodName(days), className: 'text-utility-brand-600', fill: true },
              { key: 'prev', name: prevName(days), className: 'text-utility-brand-300' },
            ]}
          />
        </Card>
        <Card
          title="النشاط المباشر"
          badge={
            <BadgeWithDot size="sm" type="modern" color="success">
              مباشر
            </BadgeWithDot>
          }
          trailing={<CardMenu actions={[{ label: 'كل النشاط', icon: ArrowUpRight, onAction: () => navigate('/admin/activity') }]} />}
        >
          {stats.activity.length ? (
            <div className="flex flex-col">
              {stats.activity.slice(0, 6).map((r, i, list) => {
                const d = describe(r);
                return <FeedItem key={i} avatar={<Avatar size="md" initials={d.initial} />} name={d.name} text={d.text} highlight={d.highlight} time={ago(r.ts)} last={i === list.length - 1} />;
              })}
            </div>
          ) : (
            <Empty title="لسه مافيش نشاط" />
          )}
        </Card>
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card title="رحلة الزائر" description="من أول زيارة لحد ما يرجع تاني" bodyClassName="flex flex-col gap-5">
          {visitors ? (
            <>
              <BarRow label="زاروا الموقع" value={fmt(visitors)} pct={100} />
              <BarRow label="استخدموه" value={`${fmt(period.people)} · ${percent(period.people, visitors)}`} pct={(period.people / visitors) * 100} />
              <BarRow label="سجّلوا حساب" value={`${fmt(period.signups)} · ${percent(period.signups, visitors)}`} pct={(period.signups / visitors) * 100} />
              <BarRow label="رجعوا يوم تاني" value={`${fmt(period.returning)} · ${percent(period.returning || 0, visitors)}`} pct={((period.returning || 0) / visitors) * 100} />
            </>
          ) : (
            <Empty title="لسه مافيش زيارات" />
          )}
        </Card>
        <Card title="أوقات الذروة" description="البرومبتات حسب الساعة، بتوقيتك">
          {stats.hours.length ? <Bars data={hours} highlight={peak} name="برومبتات" height="h-52" /> : <Empty title="لسه مافيش برومبتات" />}
        </Card>
        <Card title="أكتر المجالات" description={`من ${fmt(period.prompts)} برومبت`}>
          <BarList rows={stats.breakdowns.domains.slice(0, 5)} label={domainLabel} />
        </Card>
      </Grid>
      {stats.breakdowns.sources.length > 0 && (
        <Card title="جايين منين" description="أكبر مصادر الزوار" trailing={<CardMenu actions={[{ label: 'افتح الزيارات', icon: ArrowUpRight, onAction: () => navigate('/admin/traffic') }]} />}>
          <BarList rows={stats.breakdowns.sources.slice(0, 5)} label={sourceLabel} total={period.visitors} />
        </Card>
      )}
    </>
  );
}
