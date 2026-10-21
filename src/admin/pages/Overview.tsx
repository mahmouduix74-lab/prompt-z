import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Check, CheckCircle, HelpCircle, Send01, ThumbsDown, ThumbsUp, UserPlus01, Users01, XCircle, Zap } from '@untitledui/icons';
import { Tabs } from '../ds/components/application/tabs/tabs';
import { BadgeWithDot } from '../ds/components/base/badges/badges';
import { Button } from '../ds/components/base/buttons/button';
import { api, type Row } from '../api';
import { Heatmap, TrendChart } from '../charts';
import { ago, change, countryLabel, dateLabel, depthLabel, domainLabel, downloadCsv, fmt, money, percent, seconds } from '../format';
import { ActivityRow, BarList, Card, Empty, FunnelRow, Grid, KpiCard, PageHeader, TrendBadge } from '../ui';
import { compareSeries, cumulative, ExportButton, localWeekHours, periodName, prevName, RangePicker, spark, successRate, successSeries, type PageProps } from './common';

type Series = 'prompts' | 'people' | 'accounts' | 'enhanced';
const SERIES: { id: Series; label: string }[] = [
  { id: 'prompts', label: 'برومبتات' },
  { id: 'people', label: 'أشخاص' },
  { id: 'accounts', label: 'حسابات' },
  { id: 'enhanced', label: 'تحسين صياغة' },
];

type Tone = 'brand' | 'success' | 'warning' | 'error' | 'gray';

/** One line of the live list: who did what, with an icon and colour for the kind of event. */
function activityLine(r: Row): { icon: FC<{ className?: string }>; color: Tone; title: string; detail: string } {
  const flag = r.country ? countryLabel(r.country).split(' ')[0] : '';
  const who = r.account || `زائر من ${flag}`.trim();
  const area = r.domain ? domainLabel(r.domain) : '';
  const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' · ');
  if (r.kind === 'signup') return { icon: UserPlus01, color: 'success', title: 'حساب جديد', detail: `${r.account} سجّل بـ${r.domain === 'email' ? 'الإيميل' : 'جوجل'}` };
  if (r.kind === 'feedback')
    return r.rating === 'up'
      ? { icon: ThumbsUp, color: 'success', title: who, detail: join('قيّم برومبت 👍', area) }
      : { icon: ThumbsDown, color: 'error', title: who, detail: join('قيّم برومبت 👎', area) };
  if (r.outcome === 'clarify') return { icon: HelpCircle, color: 'warning', title: who, detail: join('الموديل سأل أسئلة توضيحية', area) };
  if (r.outcome === 'limit') return { icon: AlertCircle, color: 'warning', title: who, detail: 'وصل للحد اليومي' };
  if (r.outcome !== 'ok') return { icon: XCircle, color: 'error', title: who, detail: join(r.kind === 'refine' ? 'فشل تحسين الصياغة' : 'فشل التوليد', area) };
  if (r.kind === 'refine') return { icon: Zap, color: 'brand', title: who, detail: join('حسّن صياغة', area) };
  return { icon: Zap, color: 'brand', title: who, detail: join('عمل برومبت', area, r.depth && depthLabel(r.depth)) };
}

/** Home: the four headline numbers, prompts per day with the live activity, and the visitor journey, peak hours and top domains. */
export function Overview({ stats, days, setDays, navigate }: PageProps) {
  const { period, prev, today } = stats;
  const [series, setSeries] = useState<Series>('prompts');
  const [balance, setBalance] = useState<{ remaining: number; unavailable?: boolean } | null>(null);
  const [report, setReport] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  useEffect(() => {
    api.balance().then(setBalance, () => setBalance({ remaining: 0, unavailable: true }));
  }, []);

  const sendReport = async () => {
    setReport('sending');
    try {
      await api.testReport();
      setReport('sent');
    } catch {
      setReport('failed');
    }
  };
  const exportDaily = () =>
    downloadCsv(
      `promptz-${stats.range.start}-${stats.range.end}.csv`,
      ['day', 'prompts', 'people', 'accounts', 'enhanced', 'errors', 'cost_usd'],
      stats.daily.filter((r) => r.day >= stats.range.start).map((r) => [r.day, r.prompts, r.people, r.accounts, r.enhanced, r.errors, r.cost])
    );

  const signups = stats.signups.map((r) => ({ day: r.day, n: r.n }));
  const perDay = period.cost / days;
  const hasBalance = balance && !balance.unavailable;
  const lasts = hasBalance && perDay > 0 ? Math.floor(balance!.remaining / perDay) : null;
  const visitors = Math.max(period.visitors, period.people);

  // The big chart: the picked series for this period and the previous one, and its total.
  const chart = series === 'accounts' ? compareSeries(stats, signups, 'n') : compareSeries(stats, stats.daily, series);
  const totals: Record<Series, [number, number]> = {
    prompts: [period.prompts, prev.prompts],
    people: [period.people, prev.people],
    accounts: [period.signups, prev.signups],
    enhanced: [period.enhanced, prev.enhanced],
  };
  const [total, totalBefore] = totals[series];

  return (
    <>
      <PageHeader
        title="أهلًا بيك 👋"
        description={days === 1 ? 'ده ملخص النهارده.' : `ده ملخص ${periodName(days)}، من ${dateLabel(stats.range.start).replace(/ \d{4}$/, '')} لحد النهارده.`}
        actions={
          <>
            <RangePicker days={days} setDays={setDays} />
            <ExportButton onPress={exportDaily} />
            <Button color="primary" size="md" iconLeading={report === 'sent' ? Check : Send01} isLoading={report === 'sending'} onClick={sendReport}>
              {report === 'sent' ? 'اتبعت على إيميلك' : report === 'failed' ? 'ماتبعتش، جرّب تاني' : 'ابعت التقرير'}
            </Button>
          </>
        }
      />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Zap}
          title="برومبتات اتعملت"
          value={fmt(period.prompts)}
          {...change(period.prompts, prev.prompts)}
          note={`${fmt(prev.prompts)} ${prevName(days)}`}
          data={spark(stats, stats.daily, 'prompts')}
        />
        <KpiCard
          icon={Users01}
          title="أشخاص استخدموا الموقع"
          value={fmt(period.people)}
          {...change(period.people, prev.people)}
          note={`نشط النهارده: ${fmt(today.people)}`}
          data={spark(stats, stats.daily, 'people')}
        />
        <KpiCard
          icon={UserPlus01}
          title="حسابات جديدة"
          value={fmt(period.signups)}
          {...change(period.signups, prev.signups)}
          note={`الإجمالي: ${fmt(stats.users.total)} حساب`}
          data={cumulative(spark(stats, signups, 'n'))}
        />
        <KpiCard
          icon={CheckCircle}
          title="نسبة النجاح"
          value={period.calls ? percent(period.calls - period.errors, period.calls, 1) : '—'}
          {...change(successRate(period), successRate(prev))}
          note={`متوسط التوليد ${seconds(period.avgMs)}`}
          data={successSeries(stats)}
        />
      </Grid>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="البرومبتات في اليوم" description={`مقارنة بـ${prevName(days)}`} className="flex flex-col" bodyClassName="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-display-md font-semibold text-primary">{fmt(total)}</p>
              <TrendBadge {...change(total, totalBefore)} />
            </div>
            <Tabs selectedKey={series} onSelectionChange={(k) => setSeries(k as Series)}>
              <Tabs.List type="button-gray" size="sm" items={SERIES}>
                {(t) => <Tabs.Item {...t} />}
              </Tabs.List>
            </Tabs>
          </div>
          <TrendChart
            data={chart}
            height="min-h-80 flex-1"
            series={[
              { key: 'now', name: periodName(days), className: 'text-utility-brand-600', fill: true },
              { key: 'prev', name: prevName(days), className: 'text-utility-neutral-300' },
            ]}
          />
        </Card>
        <div className="flex flex-col gap-6">
          <div className="relative overflow-hidden rounded-2xl bg-brand-solid p-5 text-white shadow-lg">
            <div className="absolute -end-16 -top-16 size-56 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 -start-10 size-48 rounded-full bg-white/5" />
            <div className="relative flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/80">{hasBalance ? 'رصيد OpenRouter' : `الصرف ${periodName(days)}`}</p>
                <img src="/promptz-icon.svg" alt="" className="size-8 rounded-lg ring-1 ring-white/30" />
              </div>
              <div>
                <p className="text-display-md font-semibold" dir="ltr" style={{ textAlign: 'start' }}>
                  {hasBalance ? money(balance!.remaining) : money(period.cost)}
                </p>
                <p className="text-sm text-white/80">{lasts != null ? `يكفي حوالي ${fmt(lasts)} يوم` : `${money(period.prompts ? period.cost / period.prompts : 0)} للبرومبت في المتوسط`}</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">النهارده</span>
                  <span className="font-semibold" dir="ltr">
                    {money(today.cost)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, perDay ? (today.cost / perDay) * 50 : 0)}%` }} />
                </div>
              </div>
            </div>
          </div>
          <Card
            title="النشاط المباشر"
            trailing={
              <BadgeWithDot size="sm" type="modern" color="success">
                مباشر
              </BadgeWithDot>
            }
            bodyClassName="p-0 md:p-0"
          >
            {stats.activity.length ? (
              <div className="flex flex-col divide-y divide-border-secondary">
                {stats.activity.slice(0, 5).map((r, i) => {
                  const line = activityLine(r);
                  return <ActivityRow key={i} {...line} time={ago(r.ts)} />;
                })}
              </div>
            ) : (
              <Empty title="لسه مافيش نشاط" />
            )}
          </Card>
        </div>
      </div>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card title="رحلة الزائر" description="من أول زيارة لحد ما يرجع تاني" bodyClassName="flex flex-col gap-5">
          {visitors ? (
            <>
              <FunnelRow label="زاروا الموقع" value={visitors} of={visitors} step={0} />
              <FunnelRow label="عملوا برومبت" value={period.people} of={visitors} step={1} />
              <FunnelRow label="سجّلوا حساب" value={period.signups} of={visitors} step={2} />
              <FunnelRow label="رجعوا تاني" value={period.returning || 0} of={visitors} step={3} />
            </>
          ) : (
            <Empty title="لسه مافيش زيارات" />
          )}
        </Card>
        <Card title="أوقات الذروة" description="عدد البرومبتات حسب اليوم والساعة، بتوقيتك">
          {stats.hours.length ? <Heatmap grid={localWeekHours(stats.hours)} /> : <Empty title="لسه مافيش برومبتات" />}
        </Card>
        <Card
          title="أكتر المجالات"
          description={`من ${fmt(period.prompts)} برومبت`}
          trailing={
            <Button color="secondary" size="sm" onClick={() => navigate('/admin/quality')}>
              الكل
            </Button>
          }
        >
          <BarList rows={stats.breakdowns.domains.slice(0, 5)} label={domainLabel} />
        </Card>
      </Grid>
    </>
  );
}
