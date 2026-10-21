import { useEffect, useState } from 'react';
import { Calendar, CoinsStacked01, Plus, Wallet02, Zap } from '@untitledui/icons';
import { Button } from '../ds/components/base/buttons/button';
import { api } from '../api';
import { Bars } from '../charts';
import { change, dayLabel, daysBetween, depthLabel, fmt, money } from '../format';
import { BarRow, Card, Empty, Grid, MetricItem, PageHeader } from '../ui';
import { periodName, RangePicker, type PageProps } from './common';

const DEPTH_ORDER = ['short', 'medium', 'detailed', 'ultra'];

export function Costs({ stats, days, setDays }: PageProps) {
  const [balance, setBalance] = useState<{ remaining: number; unavailable?: boolean } | null>(null);
  useEffect(() => {
    api.balance().then(setBalance, () => setBalance({ remaining: 0, unavailable: true }));
  }, []);

  const { period, prev, today } = stats;
  const perPrompt = period.prompts ? period.cost / period.prompts : 0;
  const perDay = period.cost / days;
  const lasts = balance && !balance.unavailable && perDay > 0 ? Math.floor(balance.remaining / perDay) : null;
  const byDay = new Map(stats.daily.map((r) => [r.day, Number(r.cost) || 0]));
  const daily = daysBetween(stats.range.start, stats.range.end).map((day) => ({ label: dayLabel(day), value: +(byDay.get(day) || 0).toFixed(4) }));
  const prompts = new Map(stats.daily.map((r) => [r.day, Number(r.prompts) || 0]));
  const perPromptDaily = daysBetween(stats.range.start, stats.range.end).map((day) => (prompts.get(day) ? (byDay.get(day) || 0) / prompts.get(day)! : 0));
  const depths = [...stats.costByDepth].sort((a, b) => DEPTH_ORDER.indexOf(a.key) - DEPTH_ORDER.indexOf(b.key));
  const maxDepth = Math.max(...depths.map((d) => d.avg), 0);

  return (
    <>
      <PageHeader title="التكلفة والرصيد" description="مصاريف الذكاء الاصطناعي من حساب OpenRouter (من غير الناس اللي بيستخدموا مفتاحهم)" actions={
          <Button color="primary" size="md" iconLeading={Plus} href="https://openrouter.ai/settings/credits" target="_blank">
            اشحن الرصيد
          </Button>
        }
      />
      <RangePicker days={days} setDays={setDays} />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem
          title="الرصيد الباقي"
          value={!balance ? '…' : balance.unavailable ? '—' : money(balance.remaining)}
          note={balance?.unavailable ? 'ماقدرناش نقرأ الرصيد' : lasts != null ? `يكفي حوالي ${fmt(lasts)} يوم` : undefined}
          icon={Wallet02}
        />
        <MetricItem title={`الصرف ${periodName(days)}`} value={money(period.cost)} {...change(period.cost, prev.cost, { lowerIsBetter: true })} icon={CoinsStacked01} data={daily.map((d) => d.value)} />
        <MetricItem title="تكلفة البرومبت" value={money(perPrompt)} note="في المتوسط" icon={Zap} data={perPromptDaily} />
        <MetricItem title="النهارده" value={money(today.cost)} note={`${fmt(today.prompts)} برومبت`} icon={Calendar} />
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="الصرف في اليوم" description="بالدولار">
          {period.cost > 0 ? <Bars data={daily} highlight={daily.length - 1} name="$" decimals /> : <Empty title="لسه مافيش صرف متسجل" description="التكلفة بتتسجل مع كل طلب من أول ما التحديث ده يشتغل." />}
        </Card>
        <Card title="التكلفة حسب المستوى" description="متوسط تكلفة البرومبت" bodyClassName="flex flex-col gap-5">
          {depths.length ? depths.map((d) => <BarRow key={d.key} label={depthLabel(d.key)} value={money(d.avg)} pct={maxDepth ? (d.avg / maxDepth) * 100 : 0} />) : <Empty title="لسه مافيش بيانات" />}
        </Card>
      </Grid>
    </>
  );
}
