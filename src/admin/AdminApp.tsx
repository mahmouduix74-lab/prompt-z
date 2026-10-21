/**
 * The admin dashboard at /admin, built from the Untitled UI design system in src/admin/ds with the
 * site's colour and fonts (admin.css). Arabic, right to left. Its data comes from /api/admin/*
 * (src/server/admin.ts), which only answers admins.
 *
 * Each page has its own address (/admin/users, /admin/settings, ...), handled here without reloads.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { AlertCircle, Lock01, RefreshCw01 } from '@untitledui/icons';
import { EmptyState } from './ds/components/application/empty-state/empty-state';
import { Button } from './ds/components/base/buttons/button';
import { fetchAccount, type AccountState } from '../services/account';
import { safeStorage } from '../utils/storage';
import { api, ApiError, type Stats } from './api';
import { LOCALE } from './format';
import { PAGE_IDS, Shell, type PageId } from './shell';
import type { PageProps } from './pages/common';
import { Overview } from './pages/Overview';
import { Users } from './pages/Users';
import { Traffic } from './pages/Traffic';
import { Links } from './pages/Links';
import { Quality } from './pages/Quality';
import { Feedback } from './pages/Feedback';
import { ActivityPage } from './pages/Activity';
import { Costs } from './pages/Costs';
import { Errors } from './pages/Errors';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import './admin.css';

const THEME_KEY = 'pz_admin_theme';
const DAYS_KEY = 'pz_admin_days';
/** The data is fetched again this often while the page is open. */
const REFRESH_MS = 60_000;

const PAGES: Record<PageId, (props: PageProps) => ReactElement> = {
  overview: Overview,
  users: Users,
  traffic: Traffic,
  links: Links,
  quality: Quality,
  feedback: Feedback,
  activity: ActivityPage,
  costs: Costs,
  errors: Errors,
  alerts: Alerts,
  settings: Settings,
};

function pageFromPath(): PageId {
  const id = location.pathname.replace(/\/+$/, '').split('/')[2] as PageId | undefined;
  return id && PAGE_IDS.includes(id) ? id : 'overview';
}

type Load = { kind: 'loading' } | { kind: 'ready'; stats: Stats } | { kind: 'denied'; reason: string; email: string | null } | { kind: 'error'; message: string };

export default function AdminApp() {
  const [page, setPage] = useState<PageId>(pageFromPath);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search));
  const [days, setDaysState] = useState<number>(() => {
    const saved = Number(safeStorage.getItem(DAYS_KEY));
    return [1, 7, 30, 90].includes(saved) ? saved : 30;
  });
  const [dark, setDark] = useState<boolean>(() => {
    const saved = safeStorage.getItem(THEME_KEY);
    return saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  });
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [account, setAccount] = useState<AccountState | null>(null);

  // The DS tokens and fonts apply to the whole document, so popovers and dialogs get them too.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('admin-ds');
    root.dir = 'rtl';
    root.lang = 'ar';
    document.title = 'PromptZ · لوحة التحكم';
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', dark);
    safeStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const navigate = useCallback((href: string) => {
    if (!href.startsWith('/admin')) {
      location.href = href;
      return;
    }
    history.pushState(null, '', href);
    setPage(pageFromPath());
    setQuery(new URLSearchParams(location.search));
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => {
      setPage(pageFromPath());
      setQuery(new URLSearchParams(location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const reload = useCallback(async () => {
    try {
      setLoad({ kind: 'ready', stats: await api.stats(days) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLoad({ kind: 'denied', reason: err.data?.error?.reason || 'signed_out', email: err.data?.error?.email || null });
      } else {
        // A failed refresh keeps the data already on screen.
        setLoad((current) => (current.kind === 'ready' ? current : { kind: 'error', message: String((err as Error)?.message || err) }));
      }
    }
  }, [days]);

  useEffect(() => {
    reload();
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    fetchAccount().then(setAccount);
  }, []);

  const setDays = useCallback((value: number) => {
    setDaysState(value);
    safeStorage.setItem(DAYS_KEY, String(value));
  }, []);

  const counts = useMemo(() => {
    if (load.kind !== 'ready') return {};
    const s = load.stats;
    return {
      users: s.users.total,
      feedback: Number(s.feedback.totals.downPeriod) || undefined,
      errors: s.errorTypes.reduce((sum, e) => sum + e.n, 0) || undefined,
    };
  }, [load]);

  const Page = PAGES[page];
  let body: ReactElement;
  if (load.kind === 'loading') body = <Status icon={RefreshCw01} title="بنحمّل البيانات…" />;
  else if (load.kind === 'denied') body = <Denied reason={load.reason} email={load.email} />;
  else if (load.kind === 'error')
    body = <Status icon={AlertCircle} title="ماقدرناش نحمّل البيانات" description={load.message} action={<Button onClick={reload}>حاول تاني</Button>} />;
  else {
    const user = account?.user || { name: '', email: load.stats.viewer };
    body = (
      <Shell
        page={page}
        counts={counts}
        user={user}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onSearch={(q) => navigate(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`)}
      >
        <Page stats={load.stats} days={days} setDays={setDays} navigate={navigate} reload={reload} query={query} />
      </Shell>
    );
  }

  return (
    <I18nProvider locale={LOCALE}>
      <RouterProvider navigate={navigate}>
        <div className="min-h-screen bg-primary text-primary">{body}</div>
      </RouterProvider>
    </I18nProvider>
  );
}

const Status = ({ icon, title, description, action }: { icon: typeof AlertCircle; title: string; description?: string; action?: ReactElement }) => (
  <div className="flex min-h-screen items-center justify-center px-4">
    <EmptyState size="md">
      <EmptyState.Header pattern="circle">
        <EmptyState.FeaturedIcon icon={icon} color="gray" theme="modern" />
      </EmptyState.Header>
      <EmptyState.Content>
        <EmptyState.Title>{title}</EmptyState.Title>
        {description && <EmptyState.Description>{description}</EmptyState.Description>}
      </EmptyState.Content>
      {action && <EmptyState.Footer>{action}</EmptyState.Footer>}
    </EmptyState>
  </div>
);

const Denied = ({ reason, email }: { reason: string; email: string | null }) => (
  <Status
    icon={Lock01}
    title="لوحة التحكم للأدمن بس"
    description={
      reason === 'signed_out'
        ? 'سجّل دخول بإيميل الأدمن عشان تفتحها.'
        : reason === 'no_admins'
          ? 'مافيش أدمن متحدد لسه. ضيف إيميلك في ADMIN_EMAILS في إعدادات Cloudflare.'
          : `الإيميل ${email || ''} مش من الأدمن.`
    }
    action={
      reason === 'signed_out' ? (
        <Button href="/api/auth/login?next=/admin">تسجيل الدخول</Button>
      ) : (
        <Button color="secondary" href="/">
          الرجوع للموقع
        </Button>
      )
    }
  />
);
