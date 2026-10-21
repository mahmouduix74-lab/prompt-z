import { Table, TableCard } from '../ds/components/application/table/table';
import { Badge } from '../ds/components/base/badges/badges';
import { ProgressBarBase } from '../ds/components/base/progress-indicators/progress-indicators';
import { Donut } from '../charts';
import { change, depthLabel, DEVICE_LABELS, domainLabel, fmt, languageLabel, percent, seconds } from '../format';
import { BarList, BarRow, Card, Empty, Grid, MetricItem, PageHeader } from '../ui';
import { periodName, RangePicker, satisfactionSeries, successSeries, type PageProps } from './common';

const DONUT = ['text-utility-brand-600', 'text-utility-brand-400', 'text-utility-neutral-200', 'text-utility-neutral-400'];

export function Quality({ stats, days, setDays }: PageProps) {
  const { period, prev, feedback } = stats;
  const rate = (t: { calls: number; errors: number }) => (t.calls ? (t.calls - t.errors) / t.calls : 0);
  const satisfaction = (up: number, down: number) => (up + down ? up / (up + down) : 0);
  const up = Number(feedback.totals.upPeriod) || 0;
  const down = Number(feedback.totals.downPeriod) || 0;
  const upPrev = Number(feedback.totals.upPrev) || 0;
  const downPrev = Number(feedback.totals.downPrev) || 0;
  const devices = stats.breakdowns.devices.filter((d) => d.key !== 'bot');
  const primary = stats.models.length ? [...stats.models].sort((a, b) => b.n - a.n)[0].model : null;
  const success = rate(period);
  const speed = change(period.avgMs || 0, prev.avgMs || 0, { lowerIsBetter: true });

  return (
    <>
      <PageHeader title="الجودة والاستخدام" description="أداء الموديلات، ورضا المستخدمين، والإعدادات اللي بيختاروها" />
      <RangePicker days={days} setDays={setDays} />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="نسبة النجاح" value={period.calls ? percent(period.calls - period.errors, period.calls, 1) : '—'} {...change(rate(period), rate(prev))} note={`${fmt(period.errors)} فشل`} data={successSeries(stats)} chartTone={success >= 0.95 ? 'success' : 'error'} />
        <MetricItem title="متوسط وقت التوليد" value={seconds(period.avgMs)} {...speed} note={speed.change ? (speed.good ? 'أسرع' : 'أبطأ') : undefined} />
        <MetricItem title="رضا المستخدمين" value={up + down ? percent(up, up + down) : '—'} {...change(satisfaction(up, down), satisfaction(upPrev, downPrev))} note={`${fmt(up)} 👍 · ${fmt(down)} 👎`} data={satisfactionSeries(stats)} chartTone={up + down === 0 || up / (up + down) >= 0.8 ? 'success' : 'error'} />
        <MetricItem title="سأل أسئلة توضيحية" value={percent(period.clarify, period.answered, 1)} note="من طلبات التوليد" />
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <TableCard.Root className="xl:col-span-2">
          <TableCard.Header title="أداء الموديلات" description={periodName(days)} />
          {stats.models.length ? (
            <Table aria-label="الموديلات">
              <Table.Header>
                <Table.Head id="m" label="الموديل" isRowHeader className="w-full" />
                <Table.Head id="n" label="الطلبات" />
                <Table.Head id="s" label="النجاح" />
                <Table.Head id="t" label="متوسط الوقت" />
                <Table.Head id="p" label="أبطأ الطلبات" tooltip="95% من الطلبات أسرع من كده" />
              </Table.Header>
              <Table.Body items={stats.models.map((m) => ({ id: m.model, ...m }))}>
                {(m) => (
                  <Table.Row id={m.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-sm font-medium text-primary" dir="ltr">
                          {m.model}
                        </span>
                        <Badge size="sm" color={m.model === primary ? 'brand' : 'gray'}>
                          {m.model === primary ? 'أساسي' : 'احتياطي'}
                        </Badge>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{fmt(m.n)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex w-36 items-center gap-3">
                        <ProgressBarBase value={m.success * 100} className="flex-1" progressClassName={m.success > 0.95 ? 'bg-fg-success-primary' : 'bg-fg-warning-primary'} />
                        <span dir="ltr">{Math.round(m.success * 100)}%</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell dir="ltr">{seconds(m.median)}</Table.Cell>
                    <Table.Cell dir="ltr">{seconds(m.p95)}</Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          ) : (
            <Empty title="لسه مافيش طلبات للموديلات" />
          )}
        </TableCard.Root>
        <Card title="الأجهزة" description={`${fmt(period.people)} شخص`}>
          {devices.length ? (
            <Donut data={devices.slice(0, 4).map((d, i) => ({ name: DEVICE_LABELS[d.key] || d.key, value: d.n, className: DONUT[i] }))} />
          ) : (
            <Empty title="لسه مافيش بيانات" />
          )}
        </Card>
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card title="الرضا لكل مجال" description="نسبة 👍 من التقييمات" bodyClassName="flex flex-col gap-5">
          {feedback.byDomain.length ? (
            feedback.byDomain.slice(0, 6).map((d) => {
              const share = d.n ? d.up / d.n : 0;
              return <BarRow key={d.key} label={`${domainLabel(d.key)} · ${fmt(d.n)}`} value={percent(d.up, d.n)} pct={share * 100} tone={share >= 0.8 ? 'success' : share >= 0.6 ? 'warning' : 'error'} />;
            })
          ) : (
            <Empty title="لسه مافيش تقييمات" />
          )}
        </Card>
        <Card title="مستوى التفصيل" description="اللي الناس بتختاره">
          <BarList rows={stats.breakdowns.depths} label={depthLabel} total={period.prompts} />
        </Card>
        <Card title="لغة البرومبت" description="اللي الناس بتختاره">
          <BarList rows={stats.breakdowns.languages} label={languageLabel} total={period.prompts} />
        </Card>
      </Grid>
    </>
  );
}
