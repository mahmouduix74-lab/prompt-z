/** The dashboard's charts: the DS chart styles (src/admin/ds/components/application/charts) on recharts. */
import { Fragment } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLegendContent, ChartTooltipContent } from './ds/components/application/charts/charts-base';
import { cx } from './ds/utils/cx';

/** DS "Line and bar chart" (line variant): the current period in brand-600, the previous in brand-300. */
export const TrendChart = ({
  data,
  series,
  height = 'h-72',
  showLegend = true,
  interval = 'preserveStartEnd',
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string; className: string; fill?: boolean }[];
  height?: string;
  showLegend?: boolean;
  interval?: number | 'preserveStartEnd';
}) => (
  <div className={cx('flex flex-col', height)} dir="ltr">
    <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} className="h-full">
      <AreaChart data={data} className="text-tertiary [&_.recharts-text]:text-xs" margin={{ top: 12, bottom: 4, left: 0, right: 8 }}>
        <defs>
          <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" className="text-utility-brand-700" stopOpacity="0.7" />
            <stop offset="95%" stopColor="currentColor" className="text-utility-brand-700" stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
        {showLegend && <Legend align="right" verticalAlign="top" layout="horizontal" content={<ChartLegendContent className="-translate-y-2" />} />}
        <XAxis fill="currentColor" axisLine={false} tickLine={false} interval={interval} dataKey="label" padding={{ left: 10, right: 10 }} minTickGap={16} />
        <YAxis fill="currentColor" axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ className: 'stroke-utility-brand-600 stroke-2' }} />
        {series.map((s) => (
          <Area
            key={s.key}
            isAnimationActive={false}
            className={cx(s.className, '[&_.recharts-area-area]:translate-y-1.5 [&_.recharts-area-area]:[clip-path:inset(0_0_6px_0)]')}
            dataKey={s.key}
            name={s.name}
            type="monotone"
            stroke="currentColor"
            strokeWidth={2}
            fill={s.fill ? 'url(#trend-gradient)' : 'none'}
            fillOpacity={0.1}
            activeDot={{ className: 'fill-bg-primary stroke-utility-brand-600 stroke-2' }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/** DS bar chart: rounded-top bars in one brand step, one bar optionally stronger. */
export const Bars = ({
  data,
  dataKey = 'value',
  className = 'text-utility-brand-600',
  height = 'h-60',
  name = '',
  highlight,
  highlightClass = 'text-utility-brand-700',
  decimals = false,
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  className?: string;
  height?: string;
  name?: string;
  highlight?: number;
  highlightClass?: string;
  decimals?: boolean;
}) => (
  <div className={cx('flex flex-col', height)} dir="ltr">
    <ResponsiveContainer initialDimension={{ width: 1, height: 1 }} className="h-full">
      <BarChart data={data} className="text-tertiary [&_.recharts-text]:text-xs" margin={{ top: 8, bottom: 0, left: 0, right: 8 }}>
        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
        <XAxis fill="currentColor" axisLine={false} tickLine={false} interval="preserveStartEnd" dataKey="label" minTickGap={8} />
        <YAxis fill="currentColor" axisLine={false} tickLine={false} width={40} allowDecimals={decimals} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ className: 'fill-utility-neutral-50' }} />
        <Bar isAnimationActive={false} dataKey={dataKey} name={name} fill="currentColor" maxBarSize={18} radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} className={i === highlight ? highlightClass : className} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

/** DS pie chart (donut) with a legend. */
export const Donut = ({ data }: { data: { name: string; value: number; className: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="size-40 shrink-0" dir="ltr">
        <ResponsiveContainer initialDimension={{ width: 160, height: 160 }}>
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} startAngle={-270} endAngle={-630} stroke="none" fill="currentColor">
              {data.map((d) => (
                <Cell key={d.name} className={d.className} fill="currentColor" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm text-tertiary">
            <span className={cx('size-2 rounded-full bg-current', d.className)} />
            <span className="text-secondary">{d.name}</span>
            <span dir="ltr">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Weekday rows, from Saturday, as the region's week starts. dow: 0 = Sunday. */
const WEEK = [
  { dow: 6, label: 'السبت' },
  { dow: 0, label: 'الأحد' },
  { dow: 1, label: 'الاتنين' },
  { dow: 2, label: 'التلات' },
  { dow: 3, label: 'الأربع' },
  { dow: 4, label: 'الخميس' },
  { dow: 5, label: 'الجمعة' },
];
const HEAT_STEPS = ['bg-utility-neutral-100', 'bg-utility-brand-100', 'bg-utility-brand-200', 'bg-utility-brand-300', 'bg-utility-brand-500', 'bg-utility-brand-600'];

/** Prompts by weekday and hour: a grid of brand steps, darker for busier hours, with a legend. */
export const Heatmap = ({ grid, unit = 'برومبت' }: { grid: number[][]; unit?: string }) => {
  const max = Math.max(1, ...grid.flat());
  const step = (n: number) => (n ? Math.min(5, 1 + Math.floor((n / max) * 5 - 0.0001)) : 0);
  return (
    <div className="flex flex-col gap-3" dir="ltr">
      <div className="grid grid-cols-[3.5rem_repeat(24,minmax(0,1fr))] items-center gap-0.5">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-xs text-quaternary">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {WEEK.map(({ dow, label }) => (
          <Fragment key={dow}>
            <span className="pe-1.5 text-end text-xs text-tertiary">{label}</span>
            {grid[dow].map((n, h) => (
              <span key={h} title={`${label} · ${h}:00 · ${n} ${unit}`} className={cx('block h-5 rounded-[3px]', HEAT_STEPS[step(n)])} />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-1.5 self-end text-xs text-tertiary">
        <span>أقل</span>
        {HEAT_STEPS.map((c) => (
          <span key={c} className={cx('block size-3 rounded-[3px]', c)} />
        ))}
        <span>أكتر</span>
      </div>
    </div>
  );
};
