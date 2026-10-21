import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Send01 } from '@untitledui/icons';
import { Table, TableCard } from '../ds/components/application/table/table';
import { Tabs } from '../ds/components/application/tabs/tabs';
import { Avatar } from '../ds/components/base/avatar/avatar';
import { BadgeWithDot } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import { api, type Row } from '../api';
import { StackedBars, TrendChart } from '../charts';
import { ago, change, dayLabel, daysBetween, domainLabel, downloadCsv, fmt, money, percent } from '../format';
import { Card, ChangeBadge, Empty, Grid, MetricItem, PageHeader } from '../ui';
import {
  compareSeries,
  cumulative,
  describe,
  ExportButton,
  periodName,
  prevName,
  RangePicker,
  satisfactionSeries,
  spark,
  successRate,
  successSeries,
  type PageProps,
} from './common';

type Feed = 'all' | 'prompts' | 'signup' | 'feedback';

/** Home: a balance card and today's numbers beside one big chart, the health cards and the latest activity. */
export function Overview({ stats, days, setDays, navigate }: PageProps) {
  const { period, prev, today } = stats;
  const [balance, setBalance] = useState<{ remaining: number; unavailable?: boolean } | null>(null);
  const [when, setWhen] = useState<'today' | 'period'>('today');
  const [feed, setFeed] = useState<Feed>('all');
  const [report, setReport] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
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
  useEffect(() => {
    api.balance().then(setBalance, () => setBalance({ remaining: 0, unavailable: true }));
  }, []);

  const up = Number(stats.feedback.totals.upPeriod) || 0;
  const down = Number(stats.feedback.totals.downPeriod) || 0;
  const success = period.calls ? (period.calls - period.errors) / period.calls : 0;
  const perDay = period.cost / days;
  const hasBalance = balance && !balance.unavailable;
  const lasts = hasBalance && perDay > 0 ? Math.floor(balance!.remaining / perDay) : null;
  const t = when === 'today' ? today : period;
  const byDay = new Map(stats.daily.map((r) => [r.day, r]));

  // The three health cards: their change and a daily line for each.
  const successChange = change(successRate(period), successRate(prev));
  const signupChange = change(period.signups, prev.signups);
  const upPrev = Number(stats.feedback.totals.upPrev) || 0;
  const downPrev = Number(stats.feedback.totals.downPrev) || 0;
  const satisfactionChange = change(up + down ? up / (up + down) : 0, upPrev + downPrev ? upPrev / (upPrev + downPrev) : 0);

  const last14 = daysBetween(stats.range.end > stats.range.start ? new Date(Date.parse(stats.range.end) - 13 * 864e5).toISOString().slice(0, 10) : stats.range.start, stats.range.end);
  const madeDaily = last14.map((day) => ({ label: dayLabel(day), prompts: Number(byDay.get(day)?.prompts) || 0, enhanced: Number(byDay.get(day)?.enhanced) || 0 }));

  const rows = useMemo(
    () =>
      stats.activity
        .filter((r) => (feed === 'prompts' ? r.kind === 'generate' || r.kind === 'refine' : feed === 'all' ? true : r.kind === feed))
        .slice(0, 8)
        .map((r, i) => ({ ...r, id: String(i) }) as Row),
    [stats.activity, feed]
  );

  return (
    <>
      <PageHeader
        title="أهلًا بيك 👋"
        description={`${periodName(days)}، مقارنة بـ${prevName(days)}.`}
        actions={
          <>
            <ExportButton onPress={exportDaily} />
            <Button
              color="primary"
              size="md"
              iconLeading={report === 'sent' ? Check : Send01}
              isLoading={report === 'sending'}
              onClick={sendReport}
            >
              {report === 'sent' ? 'اتبعت على إيميلك' : report === 'failed' ? 'ماتبعتش، جرّب تاني' : 'ابعت التقرير'}
            </Button>
          </>
        }
      />
      <RangePicker days={days} setDays={setDays} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
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
          <div className="flex flex-col gap-4">
            <Tabs selectedKey={when} onSelectionChange={(k) => setWhen(k as 'today' | 'period')}>
              <Tabs.List
                type="underline"
                items={[
                  { id: 'today', label: 'النهارده' },
                  { id: 'period', label: periodName(days) },
                ]}
              >
                {(tab) => <Tabs.Item {...tab} />}
              </Tabs.List>
            </Tabs>
            {[
              ['برومبتات اتعملت', fmt(t.prompts)],
              ['أشخاص', fmt(t.people)],
              ['زوار', fmt(t.visitors)],
              ['حسابات جديدة', fmt(t.signups)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-tertiary">{label}</span>
                <span className="text-display-xs font-semibold text-primary">{value}</span>
              </div>
            ))}
          </div>
          <Card title="آخر 14 يوم" description="البرومبتات وتحسين الصياغة">
            <StackedBars
              data={madeDaily}
              height="h-48"
              series={[
                { key: 'prompts', name: 'برومبتات', className: 'text-utility-brand-600' },
                { key: 'enhanced', name: 'تحسين صياغة', className: 'text-utility-brand-300' },
              ]}
            />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card
            title="البرومبتات"
            trailing={
              <Button color="secondary" size="sm" onClick={() => navigate('/admin/quality')}>
                التقرير الكامل
              </Button>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-display-md font-semibold text-primary">{fmt(period.prompts)}</p>
              <ChangeBadge {...change(period.prompts, prev.prompts)} />
            </div>
            <TrendChart
              data={compareSeries(stats, stats.daily, 'prompts')}
              height="h-64"
              series={[
                { key: 'now', name: periodName(days), className: 'text-utility-brand-600', fill: true },
                { key: 'prev', name: prevName(days), className: 'text-utility-brand-300' },
              ]}
            />
          </Card>
          <Grid cols="grid-cols-1 md:grid-cols-3">
            <MetricItem
              title="نسبة النجاح"
              value={period.calls ? percent(period.calls - period.errors, period.calls, 1) : '—'}
              {...successChange}
              note={successChange.change ? undefined : `${fmt(period.errors)} طلب فشل`}
              data={successSeries(stats)}
              chartTone={success >= 0.95 ? 'success' : 'error'}
              actions={[{ label: 'سجل الأخطاء', icon: ArrowUpRight, onAction: () => navigate('/admin/errors') }]}
            />
            <MetricItem
              title="رضا المستخدمين"
              value={up + down ? percent(up, up + down) : '—'}
              {...satisfactionChange}
              note={satisfactionChange.change ? undefined : `${fmt(up)} عجبهم · ${fmt(down)} لأ`}
              data={satisfactionSeries(stats)}
              chartTone={up + down === 0 || up / (up + down) >= 0.8 ? 'success' : 'error'}
              actions={[{ label: 'التقييمات', icon: ArrowUpRight, onAction: () => navigate('/admin/feedback') }]}
            />
            <MetricItem
              title="حسابات جديدة"
              value={fmt(period.signups)}
              {...signupChange}
              note={signupChange.change ? undefined : `${fmt(stats.users.total)} حساب في الإجمالي`}
              data={cumulative(spark(stats, stats.signups, 'n'))}
              chartTone={signupChange.good === false ? 'error' : 'success'}
              actions={[{ label: 'المستخدمين', icon: ArrowUpRight, onAction: () => navigate('/admin/users') }]}
            />
          </Grid>
          <TableCard.Root>
            <TableCard.Header
              title="آخر النشاط"
              badge={
                <BadgeWithDot size="sm" type="modern" color="success">
                  مباشر
                </BadgeWithDot>
              }
              contentTrailing={
                <ButtonGroup
                  size="sm"
                  selectedKeys={[feed]}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const [key] = [...keys];
                    if (key) setFeed(key as Feed);
                  }}
                >
                  <ButtonGroupItem id="all">الكل</ButtonGroupItem>
                  <ButtonGroupItem id="prompts">برومبتات</ButtonGroupItem>
                  <ButtonGroupItem id="signup">تسجيل</ButtonGroupItem>
                  <ButtonGroupItem id="feedback">تقييمات</ButtonGroupItem>
                </ButtonGroup>
              }
            />
            {rows.length ? (
              <Table aria-label="آخر النشاط">
                <Table.Header>
                  <Table.Head id="who" label="مين" isRowHeader className="w-full" />
                  <Table.Head id="what" label="عمل إيه" />
                  <Table.Head id="area" label="المجال" />
                  <Table.Head id="when" label="إمتى" />
                </Table.Header>
                <Table.Body items={rows}>
                  {(r) => {
                    const d = describe(r);
                    return (
                      <Table.Row id={r.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <Avatar size="sm" initials={d.initial} />
                            <span className="text-sm font-medium text-primary" dir="auto">
                              {d.name}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">{d.text.replace(/ (في|بـ)$/, '')}</Table.Cell>
                        <Table.Cell className="whitespace-nowrap">{r.kind === 'signup' ? (r.domain === 'email' ? 'الإيميل' : 'Google') : r.rating ? (r.rating === 'up' ? '👍' : '👎') : domainLabel(r.domain)}</Table.Cell>
                        <Table.Cell className="whitespace-nowrap">{ago(r.ts)}</Table.Cell>
                      </Table.Row>
                    );
                  }}
                </Table.Body>
              </Table>
            ) : (
              <Empty title="مافيش نشاط هنا" />
            )}
          </TableCard.Root>
        </div>
      </div>
    </>
  );
}
