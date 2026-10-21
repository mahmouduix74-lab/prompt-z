import { useEffect, useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { ArrowUpRight, DownloadCloud02, SearchLg, Trash01 } from '@untitledui/icons';
import { PaginationCardMinimal } from '../ds/components/application/pagination/pagination';
import { SlideoutMenu } from '../ds/components/application/slideout-menus/slideout-menu';
import { Table, TableCard } from '../ds/components/application/table/table';
import { Avatar } from '../ds/components/base/avatar/avatar';
import { Badge, BadgeWithDot } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import { ButtonUtility } from '../ds/components/base/buttons/button-utility';
import { Input } from '../ds/components/base/input/input';
import { api, type Row } from '../api';
import { Bars } from '../charts';
import { ago, dateLabel, dayLabel, daysBetween, domainLabel, downloadCsv, fmt, fmt1, initials, percent } from '../format';
import { BarList, ConfirmDialog, Empty, Grid, MetricItem, PageHeader } from '../ui';
import { cumulative, ExportButton, periodName, spark, type PageProps } from './common';

type Filter = 'all' | 'today' | 'google' | 'email' | 'inactive';
type Status = 'today' | 'week' | 'inactive' | 'never';

const PAGE_SIZE = 10;
const DAY = 86_400_000;

function statusOf(u: Row, today: string): Status {
  if (!u.lastDay && !u.lastSeen) return 'never';
  const last = (u.lastSeen || u.lastDay || '').slice(0, 10);
  if (last === today) return 'today';
  return Date.parse(today) - Date.parse(last) <= 7 * DAY ? 'week' : 'inactive';
}

const STATUS: Record<Status, { label: string; color: 'success' | 'warning' | 'gray' }> = {
  today: { label: 'نشط النهارده', color: 'success' },
  week: { label: 'الأسبوع ده', color: 'warning' },
  inactive: { label: 'مش نشط', color: 'gray' },
  never: { label: 'لسه ما استخدمش', color: 'gray' },
};

export function Users({ stats, days, query, reload }: PageProps) {
  const today = stats.range.end;
  const [search, setSearch] = useState(query.get('q') || '');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortDescriptor>({ column: 'joined', direction: 'descending' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => setSearch(query.get('q') || ''), [query]);
  useEffect(() => setPage(1), [search, filter, sort]);

  const users = stats.userList;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (q && !`${u.email} ${u.name || ''}`.toLowerCase().includes(q)) return false;
      const status = statusOf(u, today);
      if (filter === 'today') return status === 'today';
      if (filter === 'google') return Boolean(u.google);
      if (filter === 'email') return Boolean(u.byEmail) && !u.google;
      if (filter === 'inactive') return status === 'inactive' || status === 'never';
      return true;
    });
    const key = (u: Row) => (sort.column === 'total' ? Number(u.total) : sort.column === 'last' ? u.lastSeen || u.lastDay || '' : u.created || '');
    list.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.direction === 'ascending' ? order : -order;
    });
    return list;
  }, [users, search, filter, sort, today]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = users.filter((u) => u.total > 0);
  const avg = stats.period.accounts ? stats.period.signedInPrompts / stats.period.accounts : 0;
  const { retention } = stats.users;

  const exportUsers = () =>
    downloadCsv(
      'promptz-users.csv',
      ['email', 'name', 'sign_in', 'joined', 'last_active', 'prompts', 'today', 'saved', 'top_domain'],
      rows.map((u) => [u.email, u.name, u.google ? 'google' : 'email', u.created, u.lastSeen || u.lastDay, u.total, u.today, u.saved, u.topDomain])
    );

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError('');
    try {
      await api.deleteUser(deleting.email);
      setDeleting(null);
      setOpen(null);
      await reload();
    } catch (err) {
      setDeleteError(String((err as Error).message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="المستخدمين" description={`${fmt(stats.users.total)} حساب · ${fmt(stats.period.signups)} جديد في ${periodName(days)}`} actions={<ExportButton onPress={exportUsers} />} />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="إجمالي الحسابات" value={fmt(stats.users.total)} note={`${fmt(active.length)} استخدموا الموقع`} data={cumulative(spark(stats, stats.signups, 'n'))} />
        <MetricItem title="نشطين النهارده" value={fmt(stats.users.activeToday)} note={`${percent(stats.users.activeToday, stats.users.total)} من الحسابات`} data={spark(stats, stats.daily, 'accounts')} />
        <MetricItem title="متوسط البرومبتات للحساب" value={fmt1(avg)} note={periodName(days)} />
        <MetricItem title="رجعوا يوم تاني" value={percent(retention.returned, retention.active)} note={`${fmt(retention.returned)} من ${fmt(retention.active)} حساب`} />
      </Grid>
      <TableCard.Root>
        <TableCard.Header
          title="كل المستخدمين"
          badge={`${fmt(rows.length)} حساب`}
          contentTrailing={
            <div className="w-full md:w-72">
              <Input size="sm" icon={SearchLg} placeholder="ابحث بالإيميل أو الاسم" aria-label="بحث" value={search} onChange={setSearch} />
            </div>
          }
        />
        <div className="overflow-x-auto border-b border-secondary px-4 py-3 md:px-6">
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
            <ButtonGroupItem id="today">نشطين النهارده</ButtonGroupItem>
            <ButtonGroupItem id="google">جوجل</ButtonGroupItem>
            <ButtonGroupItem id="email">إيميل</ButtonGroupItem>
            <ButtonGroupItem id="inactive">مش نشطين</ButtonGroupItem>
          </ButtonGroup>
        </div>
        {rows.length ? (
          <>
            <Table aria-label="المستخدمين" sortDescriptor={sort} onSortChange={setSort} onRowAction={(key) => setOpen(rows.find((u) => u.email === key) || null)}>
              <Table.Header>
                <Table.Head id="name" label="المستخدم" isRowHeader className="w-full" />
                <Table.Head id="status" label="الحالة" />
                <Table.Head id="method" label="الدخول" />
                <Table.Head id="joined" label="انضم" allowsSorting />
                <Table.Head id="last" label="آخر نشاط" allowsSorting />
                <Table.Head id="total" label="البرومبتات" allowsSorting />
                <Table.Head id="domain" label="أكتر مجال" />
                <Table.Head id="actions" />
              </Table.Header>
              <Table.Body items={visible.map((u) => ({ id: u.email, u }))}>
                {({ u }) => {
                  const status = STATUS[statusOf(u, today)];
                  return (
                    <Table.Row id={u.email}>
                      <Table.Cell>
                        <div className="flex items-center gap-3">
                          <Avatar size="md" initials={initials(u.name || u.email)} />
                          <div className="whitespace-nowrap">
                            <p className="text-sm font-medium text-primary">{u.name || u.email.split('@')[0]}</p>
                            <p className="text-sm text-tertiary" dir="ltr" style={{ textAlign: 'start' }}>
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <BadgeWithDot size="sm" type="modern" color={status.color}>
                          {status.label}
                        </BadgeWithDot>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="sm" color={u.google ? 'blue' : 'gray'}>
                          {u.google ? 'Google' : 'إيميل'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">{dateLabel(u.created)}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap">{ago(u.lastSeen || u.lastDay)}</Table.Cell>
                      <Table.Cell className="font-medium text-primary">{fmt(u.total)}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap">{u.topDomain ? domainLabel(u.topDomain) : '—'}</Table.Cell>
                      <Table.Cell className="px-4">
                        <div className="flex justify-end gap-0.5">
                          <ButtonUtility size="xs" color="tertiary" tooltip="حذف" icon={Trash01} onClick={() => setDeleting(u)} />
                          <ButtonUtility size="xs" color="tertiary" tooltip="تفاصيل" icon={ArrowUpRight} onClick={() => setOpen(u)} />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table>
            {pages > 1 && <PaginationCardMinimal page={page} total={pages} align="left" onPageChange={(p) => setPage(Math.max(1, Math.min(pages, p)))} />}
          </>
        ) : (
          <Empty title={search ? 'مافيش حد بالاسم ده' : 'مافيش حسابات هنا'} />
        )}
      </TableCard.Root>
      {open && <UserDrawer user={open} today={today} onClose={() => setOpen(null)} onDelete={() => setDeleting(open)} />}
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          setDeleteError('');
        }}
        title="حذف الحساب نهائيًا؟"
        description="هيتحذف الحساب وسجل البرومبتات وعدد الاستخدام. التقييمات والنشاط هيفضلوا في الإحصائيات من غير الإيميل. اكتب الإيميل للتأكيد."
        confirmLabel="حذف الحساب"
        typeToConfirm={deleting?.email}
        onConfirm={confirmDelete}
        busy={busy}
        error={deleteError}
      />
    </>
  );
}

function UserDrawer({ user, today, onClose, onDelete }: { user: Row; today: string; onClose: () => void; onDelete: () => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.user>> | null>(null);
  useEffect(() => {
    setDetail(null);
    api.user(user.email).then(setDetail, () => setDetail(null));
  }, [user.email]);

  const status = STATUS[statusOf(user, today)];
  const start = new Date(Date.parse(today) - 29 * DAY).toISOString().slice(0, 10);
  const byDay = new Map((detail?.daily || []).map((d) => [d.day, d.n]));
  const daily = daysBetween(start, today).map((day) => ({ label: dayLabel(day), value: byDay.get(day) || 0 }));

  const exportOne = () =>
    downloadCsv(
      `promptz-${user.email}.csv`,
      ['day', 'prompts'],
      (detail?.daily || []).map((d) => [d.day, d.n])
    );

  return (
    <SlideoutMenu isOpen isDismissable onOpenChange={(o) => !o && onClose()}>
      <SlideoutMenu.Header onClose={onClose} className="relative flex w-full items-start gap-4 px-4 pt-6 md:px-6">
        <Avatar size="xl" initials={initials(user.name || user.email)} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-lg font-semibold text-primary">{user.name || user.email.split('@')[0]}</h2>
          <p className="truncate text-sm text-tertiary" dir="ltr" style={{ textAlign: 'start' }}>
            {user.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge size="sm" color={user.google ? 'blue' : 'gray'}>
              {user.google ? 'Google' : 'إيميل'}
            </Badge>
            <BadgeWithDot size="sm" type="modern" color={status.color}>
              {status.label}
            </BadgeWithDot>
          </div>
        </div>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['البرومبتات', fmt(user.total)],
            ['النهارده', fmt(user.today)],
            ['المحفوظة', fmt(user.saved)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl p-3 ring-1 ring-secondary ring-inset">
              <p className="text-xs font-medium text-tertiary">{label}</p>
              <p className="mt-1 text-display-xs font-semibold text-primary">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-tertiary">
          انضم {dateLabel(user.created)} · آخر نشاط {ago(user.lastSeen || user.lastDay)}
          {user.ratings ? ` · ${fmt(user.ratings)} تقييم` : ''}
        </p>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-primary">النشاط آخر 30 يوم</p>
          <Bars data={daily} height="h-32" name="برومبتات" />
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-primary">المجالات اللي بيستخدمها</p>
          {detail ? <BarList rows={detail.domains} label={domainLabel} empty="لسه ما عملش برومبتات" /> : <Empty title="بنحمّل…" />}
        </div>
      </SlideoutMenu.Content>
      <SlideoutMenu.Footer className="flex w-full items-center justify-between gap-3">
        <Button color="secondary-destructive" size="md" iconLeading={Trash01} onClick={onDelete}>
          حذف الحساب
        </Button>
        <Button color="secondary" size="md" iconLeading={DownloadCloud02} onClick={exportOne} isDisabled={!detail}>
          تصدير نشاطه
        </Button>
      </SlideoutMenu.Footer>
    </SlideoutMenu>
  );
}
