import { TrendChart } from '../charts';
import { countryLabel, change, dateLabel, dayLabel, daysBetween, DEVICE_LABELS, downloadCsv, fmt, fmt1, percent, sourceLabel } from '../format';
import { BarList, Card, Empty, Grid, MetricItem, PageHeader } from '../ui';
import { ExportButton, periodName, RangePicker, spark, type PageProps } from './common';

export function Traffic({ stats, days, setDays }: PageProps) {
  const { period, prev } = stats;
  const sources = stats.breakdowns.sources;
  const top = sources[0];
  const byDay = new Map(stats.dailyVisits.map((r) => [r.day, r]));
  const daily = daysBetween(stats.range.start, stats.range.end).map((day) => ({
    label: dayLabel(day),
    visitors: Number(byDay.get(day)?.visitors) || 0,
    made: Number(byDay.get(day)?.made) || 0,
  }));
  const madeShare = (t: { visitors: number; people: number }) => (t.visitors ? Math.min(1, t.people / t.visitors) : 0);

  const exportVisits = () =>
    downloadCsv(
      `promptz-visits-${stats.range.start}-${stats.range.end}.csv`,
      ['day', 'visitors', 'made_a_prompt'],
      stats.dailyVisits.map((r) => [r.day, r.visitors, r.made])
    );

  return (
    <>
      <PageHeader
        title="الزيارات ومصادرها"
        description={
          stats.trackingSince.visits
            ? `مين بيفتح الموقع، وجاي منين، وكام واحد منهم بيستخدمه · من ${dateLabel(stats.trackingSince.visits)}`
            : 'تسجيل الزيارات بيبدأ من أول زيارة بعد التحديث ده.'
        }
        actions={
          <>
            <ExportButton onPress={exportVisits} />
            <RangePicker days={days} setDays={setDays} />
          </>
        }
      />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="زوار" value={fmt(period.visitors)} {...change(period.visitors, prev.visitors)} data={spark(stats, stats.dailyVisits, 'visitors')} />
        <MetricItem title="زيارات" value={fmt(period.visits)} {...change(period.visits, prev.visits)} note={period.visitors ? `${fmt1(period.visits / period.visitors)} لكل زائر` : undefined} />
        <MetricItem title="بيستخدموا الموقع" value={percent(madeShare(period), 1)} {...change(madeShare(period), madeShare(prev))} note="من الزوار" />
        <MetricItem title="أكبر مصدر" value={top ? sourceLabel(top.key) : '—'} note={top ? `${percent(top.n, period.visitors)} من الزوار` : undefined} />
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="الزوار في اليوم" description="واللي استخدموا الموقع منهم">
          {stats.dailyVisits.length ? (
            <TrendChart
              data={daily}
              series={[
                { key: 'visitors', name: 'زوار', className: 'text-utility-brand-600', fill: true },
                { key: 'made', name: 'عملوا برومبت', className: 'text-utility-brand-300' },
              ]}
            />
          ) : (
            <Empty title="لسه مافيش زيارات" description="الزيارات بتتسجل من أول ما التحديث ده يشتغل." />
          )}
        </Card>
        <Card title="جايين منين" description={`من ${fmt(period.visitors)} زائر`}>
          <BarList rows={sources.slice(0, 7)} label={sourceLabel} total={period.visitors} />
        </Card>
      </Grid>
      <Grid cols="grid-cols-1 xl:grid-cols-2">
        <Card title="الدول" description={`${fmt(period.people)} شخص استخدموا الموقع`}>
          <BarList rows={stats.breakdowns.countries.slice(0, 8)} label={countryLabel} total={period.people} />
        </Card>
        <Card title="الأجهزة" description={periodName(days)}>
          <BarList rows={stats.breakdowns.devices.filter((d) => d.key !== 'bot')} label={(k) => DEVICE_LABELS[k] || k} total={period.people} />
        </Card>
      </Grid>
    </>
  );
}
