/** The dashboard's building blocks, made only of design-system components (src/admin/ds). */
import { useState, type FC, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Trash01, TrendDown01, TrendUp01 } from '@untitledui/icons';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { EmptyState } from './ds/components/application/empty-state/empty-state';
import { Dialog, Modal, ModalOverlay } from './ds/components/application/modals/modal';
import { TableCard } from './ds/components/application/table/table';
import { BadgeWithIcon } from './ds/components/base/badges/badges';
import { Button } from './ds/components/base/buttons/button';
import { Dropdown } from './ds/components/base/dropdown/dropdown';
import { Input } from './ds/components/base/input/input';
import { ProgressBarBase } from './ds/components/base/progress-indicators/progress-indicators';
import { FeaturedIcon } from './ds/components/foundations/featured-icon/featured-icon';
import { cx } from './ds/utils/cx';

export interface MenuAction {
  label: string;
  icon?: FC<{ className?: string }>;
  onAction: () => void;
}

/** The DS dots menu with the given actions. */
export const CardMenu = ({ actions }: { actions: MenuAction[] }) => (
  <Dropdown.Root>
    <Dropdown.DotsButton />
    <Dropdown.Popover placement="bottom end" className="w-52">
      <Dropdown.Menu onAction={(key) => actions[Number(key)]?.onAction()}>
        {actions.map((a, i) => (
          <Dropdown.Item key={i} id={String(i)} label={a.label} icon={a.icon} />
        ))}
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown.Root>
);

/** Figma "Metric item": title, display-sm value, change, mini chart and a dots menu. */
export const MetricItem = ({
  title,
  value,
  change,
  trend = 'up',
  good: goodProp,
  note,
  data,
  icon: Icon,
  actions,
  chartTone,
  textValue,
}: {
  title: string;
  value: ReactNode;
  change?: string;
  trend?: 'up' | 'down';
  /** The mini chart's colour: green, or red when the change is bad news (the default). */
  chartTone?: 'success' | 'error';
  /** A word rather than a number (a source, a reason): set one step smaller so it fits. */
  textValue?: boolean;
  /** Whether the change is good news; by default going up is. */
  good?: boolean;
  note?: string;
  data?: number[];
  icon?: FC<{ className?: string }>;
  actions?: MenuAction[];
}) => {
  const good = goodProp ?? trend === 'up';
  return (
    <div className="@container relative flex flex-col gap-5 rounded-xl bg-primary px-4 py-5 shadow-xs ring-1 ring-secondary ring-inset md:px-5">
      <div className={cx('flex items-center gap-2', actions && 'pe-6')}>
        {Icon && <Icon className="size-5 text-fg-quaternary" />}
        <p className="text-md font-semibold text-primary">{title}</p>
      </div>
      {/* In a narrow card the chart goes under the number, full width. */}
      <div className="flex flex-col gap-4 @[20rem]:flex-row @[20rem]:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className={cx('truncate font-semibold text-primary', textValue ? 'text-display-xs' : 'text-display-sm')} dir="auto" style={{ textAlign: 'start' }}>
            {value}
          </p>
          {(change || note) && (
            <div className="flex items-center gap-2">
              {change && (
                <span className={cx('flex shrink-0 items-center gap-0.5 text-sm font-medium', good ? 'text-success-primary' : 'text-error-primary')}>
                  {trend === 'up' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                  <span dir="ltr">{change}</span>
                </span>
              )}
              {note && <span className="truncate text-sm font-medium text-tertiary">{note}</span>}
            </div>
          )}
        </div>
        {data && data.length > 1 && <MiniChart data={data} tone={chartTone ?? (change && !good ? 'error' : 'success')} className="w-full @[20rem]:w-24" />}
      </div>
      {actions && (
        <div className="absolute end-4 top-4">
          <CardMenu actions={actions} />
        </div>
      )}
    </div>
  );
};

export const MiniChart = ({ data, tone, className }: { data: number[]; tone: 'success' | 'error' | 'brand'; className?: string }) => {
  const color = tone === 'success' ? 'text-fg-success-secondary' : tone === 'error' ? 'text-fg-error-secondary' : 'text-utility-brand-600';
  const id = `mini-${tone}`;
  return (
    <div className={cx('h-12 w-24 shrink-0', color, className)} dir="ltr">
      <ResponsiveContainer initialDimension={{ width: 96, height: 48 }}>
        <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
              <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area isAnimationActive={false} dataKey="v" type="monotone" stroke="currentColor" strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Figma "Page header": text-xl semibold title, text-md tertiary supporting text, actions. */
export const PageHeader = ({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-start gap-4">
    <div className="flex w-full min-w-0 flex-col gap-0.5 md:w-auto md:min-w-80 md:flex-1">
      <h1 className="text-xl font-semibold text-primary">{title}</h1>
      {description && <p className="text-md text-tertiary">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
  </div>
);

/** A card with the DS card header (TableCard.Header) and a body. */
export const Card = ({
  title,
  description,
  badge,
  trailing,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <TableCard.Root className={className}>
    <TableCard.Header title={title} description={description} badge={badge} contentTrailing={trailing} />
    <div className={cx('px-4 py-5 md:px-6', bodyClassName)}>{children}</div>
  </TableCard.Root>
);

/** Figma "_Feed item base": avatar, connector, name, action text, time. */
export const FeedItem = ({
  avatar,
  name,
  text,
  highlight,
  time,
  last,
}: {
  avatar: ReactNode;
  name: string;
  text: string;
  highlight?: string;
  time: string;
  last?: boolean;
}) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center gap-1.5 pb-1.5">
      {avatar}
      {!last && <div className="w-0.5 flex-1 rounded-full bg-border-secondary" />}
    </div>
    <div className={cx('flex min-w-0 flex-1 flex-col', !last && 'pb-6')}>
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium text-secondary" dir="auto">
          {name}
        </p>
        <span className="ms-auto shrink-0 text-xs text-quaternary">{time}</span>
      </div>
      <p className="text-sm text-tertiary">
        {text} {highlight && <span className="font-medium text-brand-secondary">{highlight}</span>}
      </p>
    </div>
  </div>
);

export type Tone = 'brand' | 'success' | 'warning' | 'error';
const TONES: Record<Tone, string | undefined> = {
  brand: undefined,
  success: 'bg-fg-success-primary',
  warning: 'bg-fg-warning-primary',
  error: 'bg-fg-error-primary',
};

/** A labelled row with the DS progress bar and a value, for ranked lists. */
export const BarRow = ({ label, value, pct, tone = 'brand' }: { label: ReactNode; value: string; pct: number; tone?: Tone }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-secondary">{label}</span>
      <span className="shrink-0 text-tertiary" dir="ltr">
        {value}
      </span>
    </div>
    <ProgressBarBase value={Math.max(0, Math.min(100, pct))} progressClassName={TONES[tone]} />
  </div>
);

/** A ranked list of counts, or the empty state. */
export const BarList = ({ rows, label, total, empty, tone }: { rows: { key: string; n: number }[]; label: (key: string) => ReactNode; total?: number; empty?: string; tone?: (row: { key: string; n: number }) => Tone }) => {
  if (!rows.length) return <Empty title={empty || 'لسه مافيش بيانات'} />;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <div className="flex flex-col gap-5">
      {rows.map((r) => (
        <BarRow key={r.key || '_'} label={label(r.key)} value={total ? `${r.n.toLocaleString('en-US')} · ${Math.round((r.n / total) * 100)}%` : r.n.toLocaleString('en-US')} pct={(r.n / max) * 100} tone={tone?.(r)} />
      ))}
    </div>
  );
};

export const Grid = ({ cols, children }: { cols: string; children: ReactNode }) => <div className={cx('grid gap-6', cols)}>{children}</div>;

/** The DS empty state, small, for a card with nothing to show yet. */
export const Empty = ({ title, description }: { title: string; description?: string }) => (
  <EmptyState size="sm" className="py-6">
    <EmptyState.Content>
      <EmptyState.Title>{title}</EmptyState.Title>
      {description && <EmptyState.Description>{description}</EmptyState.Description>}
    </EmptyState.Content>
  </EmptyState>
);

/** The DS modal for confirming a destructive action, optionally by typing a word first. */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  typeToConfirm,
  busy,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** When set, the button stays disabled until this exact text is typed. */
  typeToConfirm?: string;
  busy?: boolean;
  error?: string;
}) => {
  const [typed, setTyped] = useState('');
  const ready = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && !busy && (setTyped(''), onClose())} isDismissable={!busy}>
      <Modal className="max-w-100">
        <Dialog aria-label={title}>
          <div className="flex w-full flex-col gap-5 p-4 sm:p-6">
            <FeaturedIcon icon={Trash01} color="error" theme="light" size="lg" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-primary">{title}</h2>
              <p className="text-sm text-tertiary">{description}</p>
            </div>
            {typeToConfirm && <Input aria-label="للتأكيد" placeholder={typeToConfirm} value={typed} onChange={setTyped} inputClassName="text-start" />}
            {error && <p className="text-sm text-error-primary">{error}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button color="secondary" size="lg" className="flex-1" onClick={onClose} isDisabled={busy}>
                إلغاء
              </Button>
              <Button color="primary-destructive" size="lg" className="flex-1" onClick={onConfirm} isDisabled={!ready} isLoading={busy}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

/** The change as a DS pill badge with a trend arrow: green when it is good news, red when not. */
export const TrendBadge = ({ change, trend = 'up', good }: { change?: string; trend?: 'up' | 'down'; good?: boolean }) => {
  if (!change) return null;
  const ok = good ?? trend === 'up';
  return (
    <BadgeWithIcon size="md" type="pill-color" color={ok ? 'success' : 'error'} iconLeading={trend === 'up' ? TrendUp01 : TrendDown01}>
      <span dir="ltr">{`${trend === 'up' ? '+' : '−'}${change}`}</span>
    </BadgeWithIcon>
  );
};

/** A headline number: icon and title, the value with its change, a supporting line and a full-width brand chart. */
export const KpiCard = ({
  icon: Icon,
  title,
  value,
  change,
  trend,
  good,
  note,
  data,
}: {
  icon: FC<{ className?: string }>;
  title: string;
  value: ReactNode;
  change?: string;
  trend?: 'up' | 'down';
  good?: boolean;
  note?: string;
  data?: number[];
}) => (
  <div className="flex flex-col gap-4 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
    <div className="flex items-center gap-2">
      <Icon className="size-5 text-fg-quaternary" />
      <p className="text-md font-medium text-secondary">{title}</p>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-display-md font-semibold text-primary" dir="auto">
          {value}
        </p>
        <TrendBadge change={change} trend={trend} good={good} />
      </div>
      {note && <p className="text-sm text-tertiary">{note}</p>}
    </div>
    <div className={cx('h-14', !data?.length && 'invisible')}>
      {data && data.length > 1 && <MiniChart data={data} tone="brand" className="h-14 w-full" />}
    </div>
  </div>
);

/** A step of a funnel: its name, the count and its share of the first step, over a bar sized to the first step. */
export const FunnelRow = ({ label, value, of, step }: { label: string; value: number; of: number; step: 0 | 1 | 2 | 3 }) => {
  const shades = ['bg-utility-brand-600', 'bg-utility-brand-500', 'bg-utility-brand-400', 'bg-utility-brand-300'];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-md text-secondary">{label}</span>
        {step > 0 && of > 0 && (
          <span className="text-sm text-tertiary" dir="ltr">
            {Math.round((value / of) * 100)}%
          </span>
        )}
        <span className="text-md font-semibold text-primary" dir="ltr">
          {value.toLocaleString('en-US')}
        </span>
      </div>
      <div className="h-6 overflow-hidden rounded-md bg-utility-neutral-100">
        <div className={cx('h-full rounded-md', shades[step])} style={{ width: `${Math.max(1.5, of ? (value / of) * 100 : 0)}%` }} />
      </div>
    </div>
  );
};

/** One line of the live activity list: a featured icon for what happened, who, the details and when. */
export const ActivityRow = ({
  icon,
  color,
  title,
  detail,
  time,
}: {
  icon: FC<{ className?: string }>;
  color: 'brand' | 'success' | 'warning' | 'error' | 'gray';
  title: ReactNode;
  detail: string;
  time: string;
}) => (
  <div className="flex items-start gap-3 px-4 py-4 md:px-6">
    <FeaturedIcon icon={icon} color={color} theme="light" size="sm" />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="truncate text-sm font-semibold text-primary" dir="auto" style={{ textAlign: 'start' }}>
        {title}
      </p>
      <p className="truncate text-sm text-tertiary">{detail}</p>
    </div>
    <span className="shrink-0 text-xs text-quaternary">{time}</span>
  </div>
);
