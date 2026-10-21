import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ThumbsDown, ThumbsUp } from '@untitledui/icons';
import { PaginationCardMinimal } from '../ds/components/application/pagination/pagination';
import { SlideoutMenu } from '../ds/components/application/slideout-menus/slideout-menu';
import { Table, TableCard } from '../ds/components/application/table/table';
import { BadgeWithIcon, Badge } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { ButtonUtility } from '../ds/components/base/buttons/button-utility';
import type { Row } from '../api';
import { ago, change, dateLabel, depthLabel, domainLabel, downloadCsv, fmt, languageLabel, percent } from '../format';
import { Empty, Grid, MetricItem, PageHeader } from '../ui';
import { ExportButton, periodName, satisfactionSeries, type PageProps } from './common';

type Filter = 'all' | 'up' | 'down' | 'comment';
const PAGE_SIZE = 10;

const Rating = ({ rating }: { rating: string }) =>
  rating === 'up' ? (
    <BadgeWithIcon size="sm" type="modern" color="success" iconLeading={ThumbsUp}>
      عجبه
    </BadgeWithIcon>
  ) : (
    <BadgeWithIcon size="sm" type="modern" color="error" iconLeading={ThumbsDown}>
      ماعجبوش
    </BadgeWithIcon>
  );

export function Feedback({ stats, days }: PageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);
  const t = stats.feedback.totals;
  const up = Number(t.upPeriod) || 0;
  const down = Number(t.downPeriod) || 0;
  const share = (u: number, d: number) => (u + d ? u / (u + d) : 0);

  useEffect(() => setPage(1), [filter]);
  const rows = useMemo(
    () =>
      stats.feedback.recent.filter((r) => (filter === 'all' ? true : filter === 'comment' ? Boolean(r.comment) : r.rating === filter)),
    [stats.feedback.recent, filter]
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportFeedback = () =>
    downloadCsv(
      'promptz-feedback.csv',
      ['time', 'rating', 'domain', 'depth', 'language', 'account', 'comment', 'request', 'prompt'],
      rows.map((r) => [r.created_at, r.rating, r.domain, r.depth, r.language, r.account, r.comment, r.request, r.prompt])
    );

  return (
    <>
      <PageHeader title="التقييمات" description="رأي الناس في البرومبتات، وملاحظاتهم" actions={<ExportButton onPress={exportFeedback} />} />
      <Grid cols="grid-cols-1 md:grid-cols-3">
        <MetricItem title="رضا المستخدمين" value={up + down ? percent(up, up + down) : '—'} {...change(share(up, down), share(Number(t.upPrev) || 0, Number(t.downPrev) || 0))} note={periodName(days)} data={satisfactionSeries(stats)} chartTone={up + down === 0 || up / (up + down) >= 0.8 ? 'success' : 'error'} />
        <MetricItem title="👍 عجبهم" value={fmt(up)} note={`${fmt(t.up)} من الأول`} />
        <MetricItem title="👎 ماعجبهمش" value={fmt(down)} trend="up" good={false} note={`${fmt(t.down)} من الأول`} />
      </Grid>
      <TableCard.Root>
        <TableCard.Header
          title="آخر التقييمات"
          badge={fmt(rows.length)}
          contentTrailing={
            <ButtonGroup
              size="sm"
              selectedKeys={[filter]}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const [key] = [...keys];
                if (key) setFilter(key as Filter);
              }}
            >
              <ButtonGroupItem id="all">الكل</ButtonGroupItem>
              <ButtonGroupItem id="down">👎</ButtonGroupItem>
              <ButtonGroupItem id="up">👍</ButtonGroupItem>
              <ButtonGroupItem id="comment">فيها ملاحظة</ButtonGroupItem>
            </ButtonGroup>
          }
        />
        {rows.length ? (
          <>
            <Table aria-label="التقييمات" onRowAction={(key) => setOpen(rows.find((r) => String(r.id) === String(key)) || null)}>
              <Table.Header>
                <Table.Head id="r" label="التقييم" isRowHeader />
                <Table.Head id="q" label="الطلب" className="w-full" />
                <Table.Head id="d" label="المجال" />
                <Table.Head id="u" label="مين" />
                <Table.Head id="w" label="إمتى" />
                <Table.Head id="a" />
              </Table.Header>
              <Table.Body items={visible.map((r) => ({ ...r, id: String(r.id) }) as Row)}>
                {(r) => (
                  <Table.Row id={r.id}>
                    <Table.Cell>
                      <Rating rating={r.rating} />
                    </Table.Cell>
                    <Table.Cell>
                      <p className="line-clamp-1 max-w-md text-sm text-primary" dir="auto">
                        {r.request || '—'}
                      </p>
                      {r.comment && (
                        <p className="line-clamp-1 max-w-md text-sm text-tertiary" dir="auto">
                          «{r.comment}»
                        </p>
                      )}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">{domainLabel(r.domain)}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap" dir="auto">
                      {r.account || 'زائر'}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">{ago(r.created_at)}</Table.Cell>
                    <Table.Cell className="px-4">
                      <ButtonUtility size="xs" color="tertiary" tooltip="تفاصيل" icon={ArrowUpRight} onClick={() => setOpen(r)} />
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
            {pages > 1 && <PaginationCardMinimal page={page} total={pages} align="left" onPageChange={(p) => setPage(Math.max(1, Math.min(pages, p)))} />}
          </>
        ) : (
          <Empty title="مافيش تقييمات هنا" />
        )}
      </TableCard.Root>
      {open && (
        <SlideoutMenu isOpen isDismissable onOpenChange={(o) => !o && setOpen(null)}>
          <SlideoutMenu.Header onClose={() => setOpen(null)} className="relative flex w-full flex-col gap-2 px-4 pt-6 md:px-6">
            <h2 className="text-lg font-semibold text-primary">تقييم برومبت</h2>
            <div className="flex flex-wrap gap-1.5">
              <Rating rating={open.rating} />
              <Badge size="sm" color="gray">
                {domainLabel(open.domain)}
              </Badge>
              {open.depth && (
                <Badge size="sm" color="gray">
                  {depthLabel(open.depth)}
                </Badge>
              )}
              {open.language && (
                <Badge size="sm" color="gray">
                  {languageLabel(open.language)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-tertiary" dir="auto">
              {open.account || 'زائر'} · {dateLabel(open.created_at)}
            </p>
          </SlideoutMenu.Header>
          <SlideoutMenu.Content>
            {open.comment && <Block title="الملاحظة" text={open.comment} />}
            <Block title="الطلب" text={open.request} />
            <Block title="البرومبت" text={open.prompt} mono />
          </SlideoutMenu.Content>
        </SlideoutMenu>
      )}
    </>
  );
}

const Block = ({ title, text, mono }: { title: string; text?: string; mono?: boolean }) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-semibold text-primary">{title}</p>
    <p className={`rounded-xl bg-secondary p-4 text-sm whitespace-pre-wrap text-secondary ring-1 ring-secondary ring-inset ${mono ? 'font-mono text-xs' : ''}`} dir="auto">
      {text || '—'}
    </p>
  </div>
);
