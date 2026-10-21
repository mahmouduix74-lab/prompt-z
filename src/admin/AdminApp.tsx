/**
 * The admin dashboard at /admin: users, usage, quality and feedback, from /api/admin/stats
 * (src/server/admin.ts). Only signed-in emails listed in ADMIN_EMAILS get the data.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Download,
  Gauge,
  HelpCircle,
  Languages,
  LayoutDashboard,
  Loader2,
  LogIn,
  MessageSquare,
  Moon,
  PieChart,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { PromptZIcon } from '../components/Logo';
import { DEPTHS, DOMAINS, OUTPUT_LANGUAGES } from '../constants';
import { safeStorage } from '../utils/storage';
import { BarList, ColumnChart, LineChart, Sparkline, fmt, useCountUp } from './charts';

type Lang = 'ar' | 'en';
type Tab = 'overview' | 'users' | 'usage' | 'feedback' | 'activity';
type Row = Record<string, any>;

interface Stats {
  generatedAt: string;
  viewer: string;
  range: { days: number; start: string; end: string; prevStart: string; prevEnd: string };
  trackingSince: string | null;
  limits: { anonymous: number; signedIn: number };
  users: { total: number; newInRange: number; newInPrev: number };
  period: Row;
  prev: Row;
  today: Row;
  latency: { median: number | null; p95: number | null; samples: number };
  daily: Row[];
  signups: Row[];
  outcomes: Row[];
  breakdowns: Record<'domains' | 'depths' | 'languages' | 'countries' | 'devices' | 'models', { key: string; n: number }[]>;
  feedback: { totals: Row; daily: Row[]; recent: Row[] };
  userList: Row[];
  activity: Row[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: Stats }
  | { kind: 'denied'; reason: 'signed_out' | 'not_admin' | 'no_admins'; email: string | null }
  | { kind: 'error'; message: string };

const T = {
  ar: {
    admin: 'لوحة التحكم',
    back: 'الموقع',
    refresh: 'تحديث',
    updated: 'آخر تحديث',
    days: (n: number) => `${n} يوم`,
    tabs: { overview: 'نظرة عامة', users: 'المستخدمون', usage: 'الاستخدام', feedback: 'التقييمات', activity: 'النشاط' },
    vsPrev: 'عن الفترة السابقة',
    promptsMade: 'برومبتات اتعملت',
    people: 'أشخاص استخدموا الموقع',
    accounts: 'الحسابات',
    newAccounts: (n: number) => `+${fmt(n)} جديد في الفترة`,
    today: 'النهارده',
    todaySub: (p: number, u: number) => `${fmt(p)} برومبت · ${fmt(u)} شخص`,
    success: 'نسبة النجاح',
    successSub: (e: number) => `${fmt(e)} فشل من الموديل`,
    speed: 'متوسط وقت التوليد',
    speedSub: (p95: string) => `95% أسرع من ${p95}`,
    satisfaction: 'رضا المستخدمين',
    satisfactionSub: (u: number, d: number) => `${fmt(u)} 👍 · ${fmt(d)} 👎`,
    limitHits: 'وصلوا للحد اليومي',
    limitSub: (s: number) => `${s}% من البرومبتات من حسابات مسجلة`,
    enhanced: 'تحسين صياغة',
    promptsPerDay: 'البرومبتات في اليوم',
    peoplePerDay: 'الأشخاص في اليوم',
    signupsPerDay: 'حسابات جديدة في اليوم',
    outcomes: 'نتيجة الطلبات',
    unitPrompts: 'برومبت',
    unitPeople: 'شخص',
    unitAccounts: 'حساب',
    outcome: { ok: 'نجح', clarify: 'سأل أسئلة توضيحية', error: 'فشل', limit: 'وصل للحد', invalid: 'طلب غير صالح', busy: 'قاعدة البيانات مشغولة' },
    domains: 'المجالات',
    depths: 'مستوى التفصيل',
    languages: 'لغة البرومبت',
    countries: 'الدول',
    devices: 'الأجهزة',
    models: 'الموديلات',
    device: { desktop: 'كمبيوتر', mobile: 'موبايل', tablet: 'تابلت', bot: 'بوت' },
    unknown: 'غير معروف',
    noData: 'لسه مافيش بيانات في الفترة دي.',
    tracking: (d: string) => `الإحصائيات التفصيلية (المجالات، الدول، الأجهزة، النتائج، السرعة) بدأت من ${d}. عدد برومبتات كل حساب في جدول المستخدمين محسوب من أول يوم.`,
    trackingNone: 'الإحصائيات التفصيلية هتبدأ من أول برومبت يتعمل بعد التحديث ده. عدد برومبتات كل حساب في جدول المستخدمين محسوب من أول يوم.',
    search: 'ابحث بالإيميل أو الاسم',
    sort: { created: 'الأحدث', total: 'الأكثر استخدامًا', last: 'آخر نشاط' },
    exportCsv: 'تصدير CSV',
    cols: { user: 'المستخدم', method: 'الدخول', joined: 'انضم', last: 'آخر نشاط', total: 'البرومبتات', today: 'النهارده', saved: 'محفوظة', domain: 'أكثر مجال', actions: '' },
    usersCount: (n: number, of: number) => (n === of ? `${fmt(n)} مستخدم` : `${fmt(n)} من ${fmt(of)} مستخدم`),
    never: 'لم يستخدم',
    google: 'جوجل',
    email: 'إيميل',
    delete: 'حذف الحساب',
    deleteTitle: 'حذف الحساب نهائيًا؟',
    deleteBody: 'هيتحذف الحساب وسجل البرومبتات وعدد الاستخدام. التقييمات والنشاط هيفضلوا في الإحصائيات من غير الإيميل. اكتب الإيميل للتأكيد.',
    cancel: 'إلغاء',
    deleting: 'جاري الحذف...',
    deleteFailed: 'ماقدرناش نحذف الحساب. حاول تاني.',
    all: 'الكل',
    request: 'الطلب',
    prompt: 'البرومبت',
    note: 'ملاحظة',
    visitor: 'زائر',
    generate: 'توليد',
    refine: 'تحسين',
    ownKey: 'مفتاحه',
    when: 'الوقت',
    who: 'مين',
    action: 'العملية',
    details: 'التفاصيل',
    result: 'النتيجة',
    took: 'المدة',
    where: 'المكان',
    latest100: 'آخر 100 عملية',
    latest50: 'آخر 50 تقييم',
    deniedTitle: 'لوحة التحكم للأدمن بس',
    signedOut: 'سجّل دخول بحساب الأدمن عشان تفتح لوحة التحكم.',
    notAdmin: (e: string) => `أنت مسجل دخول بـ ${e}، والإيميل ده مش في ADMIN_EMAILS.`,
    noAdmins: 'مافيش إيميلات في ADMIN_EMAILS على السيرفر. ضيف إيميلك في Cloudflare ← Settings ← Variables.',
    signIn: 'سجّل دخول بجوجل',
    switchAccount: 'سجّل خروج وادخل بحساب تاني',
    errorTitle: 'حصلت مشكلة في تحميل البيانات',
    retry: 'حاول تاني',
    ago: { now: 'دلوقتي', m: (n: number) => `من ${n} د`, h: (n: number) => `من ${n} س`, d: (n: number) => `من ${n} يوم` },
    table: 'جدول',
    chart: 'رسم',
    date: 'اليوم',
  },
  en: {
    admin: 'Admin',
    back: 'Site',
    refresh: 'Refresh',
    updated: 'Updated',
    days: (n: number) => `${n} days`,
    tabs: { overview: 'Overview', users: 'Users', usage: 'Usage', feedback: 'Feedback', activity: 'Activity' },
    vsPrev: 'vs previous period',
    promptsMade: 'Prompts made',
    people: 'People who used it',
    accounts: 'Accounts',
    newAccounts: (n: number) => `+${fmt(n)} new in this period`,
    today: 'Today',
    todaySub: (p: number, u: number) => `${fmt(p)} prompts · ${fmt(u)} people`,
    success: 'Success rate',
    successSub: (e: number) => `${fmt(e)} model failures`,
    speed: 'Median generation time',
    speedSub: (p95: string) => `95% finish within ${p95}`,
    satisfaction: 'Satisfaction',
    satisfactionSub: (u: number, d: number) => `${fmt(u)} 👍 · ${fmt(d)} 👎`,
    limitHits: 'Hit the daily limit',
    limitSub: (s: number) => `${s}% of prompts from signed-in accounts`,
    enhanced: 'Enhanced',
    promptsPerDay: 'Prompts per day',
    peoplePerDay: 'People per day',
    signupsPerDay: 'New accounts per day',
    outcomes: 'How requests ended',
    unitPrompts: 'prompts',
    unitPeople: 'people',
    unitAccounts: 'accounts',
    outcome: { ok: 'Succeeded', clarify: 'Asked clarifying questions', error: 'Failed', limit: 'Hit the limit', invalid: 'Invalid request', busy: 'Database busy' },
    domains: 'Domains',
    depths: 'Detail level',
    languages: 'Prompt language',
    countries: 'Countries',
    devices: 'Devices',
    models: 'Models',
    device: { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', bot: 'Bot' },
    unknown: 'Unknown',
    noData: 'No data in this period yet.',
    tracking: (d: string) => `Detailed stats (domains, countries, devices, outcomes, speed) start on ${d}. Each account's prompt count in Users goes back to day one.`,
    trackingNone: "Detailed stats start with the first prompt made after this update. Each account's prompt count in Users goes back to day one.",
    search: 'Search by email or name',
    sort: { created: 'Newest', total: 'Most prompts', last: 'Last active' },
    exportCsv: 'Export CSV',
    cols: { user: 'User', method: 'Sign-in', joined: 'Joined', last: 'Last active', total: 'Prompts', today: 'Today', saved: 'Saved', domain: 'Top domain', actions: '' },
    usersCount: (n: number, of: number) => (n === of ? `${fmt(n)} users` : `${fmt(n)} of ${fmt(of)} users`),
    never: 'Never',
    google: 'Google',
    email: 'Email',
    delete: 'Delete account',
    deleteTitle: 'Delete this account for good?',
    deleteBody: 'This removes the account, its saved prompts and its usage counts. Ratings and activity stay in the stats without the email. Type the email to confirm.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    deleteFailed: 'Could not delete the account. Try again.',
    all: 'All',
    request: 'Request',
    prompt: 'Prompt',
    note: 'Note',
    visitor: 'Visitor',
    generate: 'Generate',
    refine: 'Enhance',
    ownKey: 'own key',
    when: 'When',
    who: 'Who',
    action: 'Action',
    details: 'Details',
    result: 'Result',
    took: 'Took',
    where: 'Where',
    latest100: 'Latest 100 actions',
    latest50: 'Latest 50 ratings',
    deniedTitle: 'Admins only',
    signedOut: 'Sign in with an admin account to open the dashboard.',
    notAdmin: (e: string) => `You are signed in as ${e}, which is not in ADMIN_EMAILS.`,
    noAdmins: 'ADMIN_EMAILS has no addresses on the server. Add yours in Cloudflare → Settings → Variables.',
    signIn: 'Sign in with Google',
    switchAccount: 'Sign out and use another account',
    errorTitle: 'Could not load the dashboard',
    retry: 'Try again',
    ago: { now: 'just now', m: (n: number) => `${n}m ago`, h: (n: number) => `${n}h ago`, d: (n: number) => `${n}d ago` },
    table: 'Table',
    chart: 'Chart',
    date: 'Day',
  },
};
type Strings = (typeof T)['ar'];

const STATUS: Record<string, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ok: { color: 'var(--good)', Icon: CheckCircle2 },
  clarify: { color: 'var(--warning)', Icon: HelpCircle },
  limit: { color: 'var(--serious)', Icon: Ban },
  error: { color: 'var(--critical)', Icon: XCircle },
  invalid: { color: 'var(--neutral)', Icon: AlertTriangle },
  busy: { color: 'var(--neutral)', Icon: AlertTriangle },
};

const card = 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_2px_rgba(24,22,34,0.04)]';

function dayList(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function useFormatters(lang: Lang) {
  return useMemo(() => {
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    const short = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const dateTime = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    let regions: Intl.DisplayNames | null = null;
    try {
      regions = new Intl.DisplayNames([lang === 'ar' ? 'ar' : 'en'], { type: 'region' });
    } catch {}
    return {
      shortDay: (d: string) => short.format(new Date(`${d}T00:00:00Z`)),
      longDay: (d: string) => long.format(new Date(`${d}T00:00:00Z`)),
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      country: (code: string) => {
        if (!code) return '';
        try {
          return regions?.of(code) || code;
        } catch {
          return code;
        }
      },
    };
  }, [lang]);
}

const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌐';

const seconds = (ms: number | null) => (ms == null ? '–' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

function ago(iso: string, t: Strings): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return t.ago.now;
  if (mins < 60) return t.ago.m(mins);
  if (mins < 1440) return t.ago.h(Math.floor(mins / 60));
  return t.ago.d(Math.floor(mins / 1440));
}

export default function AdminApp() {
  const [lang, setLang] = useState<Lang>(() => (safeStorage.getItem('app_language_preference') === 'en' ? 'en' : 'ar'));
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (safeStorage.getItem('theme_preference') === 'dark' ? 'dark' : 'light'));
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [tab, setTab] = useState<Tab>(() => {
    const h = location.hash.slice(1) as Tab;
    return ['overview', 'users', 'usage', 'feedback', 'activity'].includes(h) ? h : 'overview';
  });
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const t = T[lang];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    safeStorage.setItem('theme_preference', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    safeStorage.setItem('app_language_preference', lang);
  }, [lang]);
  useEffect(() => {
    document.title = 'PromptZ Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    history.replaceState(null, '', tab === 'overview' ? '/admin' : `/admin#${tab}`);
  }, [tab]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?days=${days}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 403) setState({ kind: 'denied', reason: data?.error?.reason || 'signed_out', email: data?.error?.email || null });
      else if (!res.ok || !data) setState({ kind: 'error', message: data?.error?.message || `HTTP ${res.status}` });
      else setState({ kind: 'ready', stats: data });
    } catch (err: any) {
      setState({ kind: 'error', message: String(err?.message || err) });
    } finally {
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: Tab; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', Icon: LayoutDashboard },
    { id: 'users', Icon: Users },
    { id: 'usage', Icon: PieChart },
    { id: 'feedback', Icon: MessageSquare },
    { id: 'activity', Icon: Activity },
  ];
  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="admin-root min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 h-16">
          <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label="PromptZ">
            <PromptZIcon sizeClass="w-8 h-8" />
            <span className="hidden sm:inline font-bold tracking-tight" dir="ltr">
              Prompt<span className="text-brand-600 dark:text-brand-400">Z</span>
            </span>
          </a>
          <span className="rounded-md bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">{t.admin}</span>
          <div className="flex-1" />
          {state.kind === 'ready' && (
            <div className="hidden md:flex rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 text-sm" role="group">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={`h-7 rounded-lg px-3 font-medium transition-colors ${days === d ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  {t.days(d)}
                </button>
              ))}
            </div>
          )}
          <div className="flex h-9 items-center rounded-xl border border-zinc-200 dark:border-zinc-800 px-1">
            <button type="button" onClick={load} title={t.refresh} aria-label={t.refresh} className="inline-flex h-7 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title="Language" aria-label="Language" className="inline-flex h-7 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Languages className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Theme" aria-label="Theme" className="inline-flex h-7 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <a href="/" className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <BackIcon className="h-4 w-4" />
            {t.back}
          </a>
        </div>
        {state.kind === 'ready' && (
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 -mb-px">
            {tabs.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${tab === id ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                <Icon className="h-4 w-4" />
                {t.tabs[id]}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {state.kind === 'loading' && <Loading />}
        {state.kind === 'error' && <ErrorView t={t} message={state.message} onRetry={load} />}
        {state.kind === 'denied' && <Denied t={t} reason={state.reason} email={state.email} />}
        {state.kind === 'ready' && (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t.tabs[tab]}</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t.updated} {new Date(state.stats.generatedAt).toLocaleTimeString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' })} · {state.stats.viewer}
                </p>
              </div>
              <div className="flex md:hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 text-sm" role="group">
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    aria-pressed={days === d}
                    className={`h-7 rounded-lg px-3 font-medium ${days === d ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-500'}`}
                  >
                    {t.days(d)}
                  </button>
                ))}
              </div>
            </div>
            <TrackingNote stats={state.stats} t={t} lang={lang} />
            {tab === 'overview' && <Overview stats={state.stats} t={t} lang={lang} />}
            {tab === 'users' && <UsersView stats={state.stats} t={t} lang={lang} onDeleted={load} />}
            {tab === 'usage' && <UsageView stats={state.stats} t={t} lang={lang} />}
            {tab === 'feedback' && <FeedbackView stats={state.stats} t={t} lang={lang} />}
            {tab === 'activity' && <ActivityView stats={state.stats} t={t} lang={lang} />}
          </>
        )}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`${card} h-32 animate-pulse`} />
      ))}
      <div className={`${card} h-72 animate-pulse sm:col-span-2 lg:col-span-4`} />
    </div>
  );
}

function ErrorView({ t, message, onRetry }: { t: Strings; message: string; onRetry: () => void }) {
  return (
    <div className={`${card} mx-auto max-w-md p-8 text-center`}>
      <AlertTriangle className="mx-auto h-10 w-10 text-[var(--critical)]" />
      <h1 className="mt-4 text-lg font-semibold">{t.errorTitle}</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 break-words" dir="ltr">
        {message}
      </p>
      <button type="button" onClick={onRetry} className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        <RefreshCw className="h-4 w-4" />
        {t.retry}
      </button>
    </div>
  );
}

function Denied({ t, reason, email }: { t: Strings; reason: string; email: string | null }) {
  return (
    <div className={`${card} mx-auto mt-10 max-w-md p-8 text-center`}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 dark:bg-brand-950/60">
        <ShieldAlert className="h-7 w-7 text-brand-600 dark:text-brand-400" />
      </div>
      <h1 className="mt-5 text-xl font-bold">{t.deniedTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {reason === 'signed_out' ? t.signedOut : reason === 'no_admins' ? t.noAdmins : t.notAdmin(email || '')}
      </p>
      {reason === 'signed_out' ? (
        <a href="/api/auth/login?next=/admin" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700">
          <LogIn className="h-4 w-4" />
          {t.signIn}
        </a>
      ) : (
        <a href="/api/auth/logout" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-6 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800">
          {t.switchAccount}
        </a>
      )}
    </div>
  );
}

function TrackingNote({ stats, t, lang }: { stats: Stats; t: Strings; lang: Lang }) {
  const f = useFormatters(lang);
  if (stats.trackingSince && stats.trackingSince <= stats.range.prevStart) return null;
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/70 dark:bg-brand-950/30 px-4 py-3 text-sm text-brand-900 dark:text-brand-200">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{stats.trackingSince ? t.tracking(f.longDay(stats.trackingSince)) : t.trackingNone}</p>
    </div>
  );
}

/** A daily series over the whole range, with missing days as zero. */
function series(stats: Stats, rows: Row[], field: string): number[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r[field]) || 0]));
  return dayList(stats.range.start, stats.range.end).map((d) => byDay.get(d) || 0);
}

function Delta({ now, before, t, goodWhenUp = true }: { now: number; before: number; t: Strings; goodWhenUp?: boolean }) {
  if (!before && !now) return null;
  const change = before ? Math.round(((now - before) / before) * 100) : null;
  const up = now >= before;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={t.vsPrev}>
      <span className={`inline-flex items-center gap-0.5 font-semibold ${now === before ? 'text-zinc-500' : good ? 'text-[var(--good-text)]' : 'text-[var(--critical)]'}`}>
        <Icon className="h-3.5 w-3.5" />
        {change == null ? `+${fmt(now)}` : `${change > 0 ? '+' : ''}${change}%`}
      </span>
      <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">{t.vsPrev}</span>
    </span>
  );
}

function Tile({
  label,
  value,
  display,
  sub,
  Icon,
  delta,
  spark,
}: {
  label: string;
  value: number | null;
  display?: (v: number) => string;
  sub?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  delta?: React.ReactNode;
  spark?: number[];
}) {
  const shown = useCountUp(value ?? 0);
  return (
    <div className={`${card} flex flex-col p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums" dir="ltr" style={{ textAlign: 'start' }}>
        {value == null ? '–' : display ? display(value) : fmt(shown)}
      </div>
      {delta && <div className="mt-1.5">{delta}</div>}
      {sub && <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>}
      {spark && <div className="mt-auto pt-3">{spark.length > 1 && <Sparkline values={spark} />}</div>}
    </div>
  );
}

function ChartCard({
  title,
  total,
  children,
  table,
  t,
}: {
  title: string;
  total?: string;
  children: React.ReactNode;
  table?: { head: [string, string]; rows: [string, string][] };
  t: Strings;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {total && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{total}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable(!asTable)} className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {asTable ? t.chart : t.table}
          </button>
        )}
      </div>
      {asTable && table ? (
        <div className="max-h-[220px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-zinc-900 text-xs text-zinc-500">
              <tr>
                <th className="py-1.5 text-start font-medium">{table.head[0]}</th>
                <th className="py-1.5 text-end font-medium">{table.head[1]}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {table.rows.map(([a, b]) => (
                <tr key={a} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">{a}</td>
                  <td className="py-1.5 text-end">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Overview({ stats, t, lang }: { stats: Stats; t: Strings; lang: Lang }) {
  const f = useFormatters(lang);
  const days = dayList(stats.range.start, stats.range.end);
  const labels: string[] = days.map((d) => f.shortDay(d));
  const titles: string[] = days.map((d) => f.longDay(d));
  const prompts = series(stats, stats.daily, 'prompts');
  const people = series(stats, stats.daily, 'people');
  const signups = series(stats, stats.signups, 'n');
  const p = stats.period;
  const ok = Number(p.prompts) || 0;
  const errors = Number(p.errors) || 0;
  const success = ok + errors ? Math.round((ok / (ok + errors)) * 1000) / 10 : null;
  const up = Number(stats.feedback.totals.upPeriod) || 0;
  const down = Number(stats.feedback.totals.downPeriod) || 0;
  const satisfaction = up + down ? Math.round((up / (up + down)) * 100) : null;
  const signedShare = ok ? Math.round(((Number(p.signedInPrompts) || 0) / ok) * 100) : 0;
  const tableOf = (values: number[]): [string, string][] => days.map((d, i) => [f.shortDay(d), fmt(values[i])] as [string, string]).reverse();

  const outcomeRows = ['ok', 'clarify', 'error', 'limit', 'invalid', 'busy']
    .map((o) => ({ key: o, n: stats.outcomes.filter((r) => r.outcome === o).reduce((s, r) => s + Number(r.n), 0) }))
    .filter((r) => r.n > 0);
  const outcomeTotal = outcomeRows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label={t.promptsMade} value={ok} Icon={Zap} delta={<Delta now={ok} before={Number(stats.prev.prompts) || 0} t={t} />} spark={prompts} />
        <Tile label={t.people} value={Number(p.people) || 0} Icon={Users} delta={<Delta now={Number(p.people) || 0} before={Number(stats.prev.people) || 0} t={t} />} spark={people} />
        <Tile label={t.accounts} value={stats.users.total} Icon={UserPlus} sub={t.newAccounts(stats.users.newInRange)} delta={<Delta now={stats.users.newInRange} before={stats.users.newInPrev} t={t} />} />
        <Tile label={t.today} value={Number(stats.today.prompts) || 0} Icon={Activity} sub={t.todaySub(Number(stats.today.prompts) || 0, Number(stats.today.people) || 0)} />
        <Tile label={t.success} value={success} display={(v) => `${v}%`} Icon={CheckCircle2} sub={t.successSub(errors)} />
        <Tile label={t.speed} value={stats.latency.median} display={(v) => seconds(v)} Icon={Timer} sub={stats.latency.p95 != null ? t.speedSub(seconds(stats.latency.p95)) : undefined} />
        <Tile label={t.satisfaction} value={satisfaction} display={(v) => `${v}%`} Icon={ThumbsUp} sub={t.satisfactionSub(up, down)} />
        <Tile label={t.limitHits} value={Number(p.limits) || 0} Icon={Gauge} sub={t.limitSub(signedShare)} />
      </div>

      <ChartCard title={t.promptsPerDay} total={`${fmt(ok)} ${t.unitPrompts} · ${fmt(Number(p.enhanced) || 0)} ${t.enhanced}`} t={t} table={{ head: [t.date, t.unitPrompts], rows: tableOf(prompts) }}>
        <LineChart labels={labels} titles={titles} values={prompts} unit={t.unitPrompts} height={260} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t.peoplePerDay} t={t} table={{ head: [t.date, t.unitPeople], rows: tableOf(people) }}>
          <LineChart labels={labels} titles={titles} values={people} unit={t.unitPeople} />
        </ChartCard>
        <ChartCard title={t.signupsPerDay} total={t.newAccounts(stats.users.newInRange)} t={t} table={{ head: [t.date, t.unitAccounts], rows: tableOf(signups) }}>
          <ColumnChart labels={labels} titles={titles} values={signups} unit={t.unitAccounts} />
        </ChartCard>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="text-sm font-semibold">{t.outcomes}</h2>
        {outcomeTotal ? (
          <>
            <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" dir="ltr">
              {outcomeRows.map((r) => (
                <div key={r.key} title={`${t.outcome[r.key as keyof Strings['outcome']]}: ${fmt(r.n)}`} style={{ width: `${(r.n / outcomeTotal) * 100}%`, background: STATUS[r.key].color }} />
              ))}
            </div>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {outcomeRows.map((r) => {
                const { Icon, color } = STATUS[r.key];
                return (
                  <li key={r.key} className="flex items-center gap-2">
                    <span style={{ color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-200">{t.outcome[r.key as keyof Strings['outcome']]}</span>
                    <span className="ms-auto tabular-nums font-semibold">{fmt(r.n)}</span>
                    <span className="w-10 text-end tabular-nums text-zinc-500">{Math.round((r.n / outcomeTotal) * 100)}%</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">{t.noData}</p>
        )}
      </section>
    </div>
  );
}

function useLabels(lang: Lang, t: Strings) {
  const f = useFormatters(lang);
  return useMemo(() => {
    const pick = (o: { labelAr: string; labelEn: string } | undefined, key: string) => (o ? (lang === 'ar' ? o.labelAr : o.labelEn) : key || t.unknown);
    return {
      domain: (k: string) => pick(DOMAINS.find((d) => d.id === k), k),
      depth: (k: string) => pick(DEPTHS.find((d) => d.id === k), k),
      language: (k: string) => pick(OUTPUT_LANGUAGES.find((d) => d.id === k), k),
      country: (k: string) => (k ? `${flag(k)} ${f.country(k)}` : t.unknown),
      device: (k: string) => t.device[k as keyof Strings['device']] || k || t.unknown,
      model: (k: string) => k || t.unknown,
    };
  }, [lang, t, f]);
}

function UsageView({ stats, t, lang }: { stats: Stats; t: Strings; lang: Lang }) {
  const L = useLabels(lang, t);
  const b = stats.breakdowns;
  const lists: { title: string; rows: { key: string; n: number }[]; label: (k: string) => string }[] = [
    { title: t.domains, rows: b.domains, label: L.domain },
    { title: t.depths, rows: b.depths, label: L.depth },
    { title: t.languages, rows: b.languages, label: L.language },
    { title: t.countries, rows: b.countries, label: L.country },
    { title: t.devices, rows: b.devices, label: L.device },
    { title: t.models, rows: b.models, label: L.model },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lists.map((l) => (
        <section key={l.title} className={`${card} p-5`}>
          <h2 className="mb-4 text-sm font-semibold">{l.title}</h2>
          <BarList rows={l.rows.map((r) => ({ key: r.key || '-', label: l.label(r.key), n: Number(r.n) }))} empty={t.noData} />
        </section>
      ))}
    </div>
  );
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function UsersView({ stats, t, lang, onDeleted }: { stats: Stats; t: Strings; lang: Lang; onDeleted: () => void }) {
  const f = useFormatters(lang);
  const L = useLabels(lang, t);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'created' | 'total' | 'last'>('created');
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stats.userList.filter((u) => !q || String(u.email).includes(q) || String(u.name || '').toLowerCase().includes(q));
    const by = { created: 'created', total: 'total', last: 'lastDay' }[sort];
    return [...list].sort((a, b) => (sort === 'total' ? Number(b.total) - Number(a.total) : String(b[by] || '').localeCompare(String(a[by] || ''))));
  }, [stats.userList, query, sort]);

  const exportCsv = () => {
    const head = ['email', 'name', 'joined', 'sign_in', 'last_active', 'prompts_total', 'prompts_today', 'saved_prompts', 'ratings', 'top_domain'];
    const lines = rows.map((u) =>
      [u.email, u.name, u.created, [u.google ? 'google' : '', u.byEmail ? 'email' : ''].filter(Boolean).join('+'), u.lastDay, u.total, u.today, u.saved, u.ratings, u.topDomain]
        .map(csvEscape)
        .join(',')
    );
    const blob = new Blob([`﻿${head.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `promptz-users-${stats.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 ps-9 pe-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
          aria-label="Sort"
        >
          {(['created', 'total', 'last'] as const).map((s) => (
            <option key={s} value={s}>
              {t.sort[s]}
            </option>
          ))}
        </select>
        <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
          <Download className="h-4 w-4" />
          {t.exportCsv}
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{t.usersCount(rows.length, stats.userList.length)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              {(['user', 'method', 'joined', 'last', 'total', 'today', 'saved', 'domain', 'actions'] as const).map((c) => (
                <th key={c} className={`px-4 py-3 font-medium ${['total', 'today', 'saved'].includes(c) ? 'text-end' : 'text-start'}`}>
                  {t.cols[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((u) => (
              <tr key={u.email} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 dark:bg-brand-950 text-xs font-bold uppercase text-brand-700 dark:text-brand-300">
                      {(u.name || u.email || '?').trim().charAt(0)}
                    </span>
                    <div className="min-w-0">
                      {u.name && <div className="truncate font-medium">{u.name}</div>}
                      <div className="truncate text-zinc-500 dark:text-zinc-400" dir="ltr" style={{ textAlign: 'start' }}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {u.google ? <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs">{t.google}</span> : null}
                    {u.byEmail ? <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs">{t.email}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{u.created ? f.shortDay(String(u.created).slice(0, 10)) : '–'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{u.lastDay ? f.shortDay(u.lastDay) : <span className="text-zinc-400">{t.never}</span>}</td>
                <td className="px-4 py-3 text-end font-semibold tabular-nums">{fmt(Number(u.total))}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt(Number(u.today))}</td>
                <td className="px-4 py-3 text-end tabular-nums">{fmt(Number(u.saved))}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{u.topDomain ? L.domain(u.topDomain) : '–'}</td>
                <td className="px-4 py-3 text-end">
                  <button type="button" onClick={() => setToDelete(u)} title={t.delete} aria-label={`${t.delete} ${u.email}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-[var(--critical)] dark:hover:bg-red-950/40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-sm text-zinc-500">{t.noData}</p>}
      </div>
      {toDelete && <DeleteDialog user={toDelete} t={t} onClose={() => setToDelete(null)} onDone={() => (setToDelete(null), onDeleted())} />}
    </section>
  );
}

function DeleteDialog({ user, t, onClose, onDone }: { user: Row; t: Strings; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = typed.trim().toLowerCase() === String(user.email).toLowerCase();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) });
      if (!res.ok) throw new Error(String(res.status));
      onDone();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className={`${card} w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 id="delete-title" className="text-lg font-semibold">
            {t.deleteTitle}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t.deleteBody}</p>
        <p className="mt-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium" dir="ltr">
          {user.email}
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          dir="ltr"
          className="mt-3 h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
          aria-label={user.email}
        />
        {failed && <p className="mt-2 text-sm text-[var(--critical)]">{t.deleteFailed}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={!matches || busy}
            onClick={confirm}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--critical)] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? t.deleting : t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackView({ stats, t, lang }: { stats: Stats; t: Strings; lang: Lang }) {
  const f = useFormatters(lang);
  const L = useLabels(lang, t);
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');
  const totals = stats.feedback.totals;
  const up = Number(totals.up) || 0;
  const down = Number(totals.down) || 0;
  const items = stats.feedback.recent.filter((r) => filter === 'all' || r.rating === filter);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="👍" value={up} Icon={ThumbsUp} />
        <Tile label="👎" value={down} Icon={ThumbsDown} />
        <Tile label={t.satisfaction} value={up + down ? Math.round((up / (up + down)) * 100) : null} display={(v) => `${v}%`} Icon={Gauge} />
      </div>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 p-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{t.latest50}</span>
          <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 text-sm" role="group">
            {(['all', 'up', 'down'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-7 rounded-lg px-3 font-medium ${filter === k ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
                {k === 'all' ? t.all : k === 'up' ? '👍' : '👎'}
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((r) => (
            <li key={r.id}>
              <details className="group px-4 py-3" open={false}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-lg">{r.rating === 'up' ? '👍' : '👎'}</span>
                  <span className="text-sm font-medium">{L.domain(r.domain)}</span>
                  <span className="text-xs text-zinc-500">
                    {L.depth(r.depth)} · {L.language(r.language)}
                  </span>
                  <span className="ms-auto text-xs text-zinc-500" dir="ltr">
                    {r.account || t.visitor} · {f.dateTime(r.created_at)}
                  </span>
                  {r.comment && (
                    <p className="w-full text-sm font-medium text-[var(--critical)]" dir="auto">
                      {t.note}: {r.comment}
                    </p>
                  )}
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-zinc-500">{t.request}</h3>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3 text-xs" dir="auto">
                      {r.request}
                    </pre>
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold text-zinc-500">{t.prompt}</h3>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-50 dark:bg-zinc-950 p-3 font-mono text-xs" dir="auto">
                      {r.prompt}
                    </pre>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
        {!items.length && <p className="p-8 text-center text-sm text-zinc-500">{t.noData}</p>}
      </section>
    </div>
  );
}

function ActivityView({ stats, t, lang }: { stats: Stats; t: Strings; lang: Lang }) {
  const f = useFormatters(lang);
  const L = useLabels(lang, t);
  return (
    <section className={card}>
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-500 dark:text-zinc-400">{t.latest100}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              {[t.when, t.who, t.action, t.details, t.result, t.took, t.where].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stats.activity.map((e, i) => {
              const status = STATUS[e.outcome] || STATUS.invalid;
              return (
                <tr key={i} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300" title={f.dateTime(e.ts)}>
                    {ago(e.ts, t)}
                  </td>
                  <td className="px-4 py-2.5 max-w-[220px] truncate" dir="ltr" style={{ textAlign: 'start' }}>
                    {e.account || <span className="text-zinc-400">{t.visitor}</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {e.kind === 'refine' ? t.refine : t.generate}
                    {e.ownKey ? <span className="ms-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px]">{t.ownKey}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {[e.domain && L.domain(e.domain), e.depth && L.depth(e.depth), e.language && L.language(e.language)].filter(Boolean).join(' · ') || '–'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span style={{ color: status.color }}>
                        <status.Icon className="h-4 w-4" />
                      </span>
                      {t.outcome[e.outcome as keyof Strings['outcome']] || e.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-300">{seconds(e.ms)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {e.country ? `${flag(e.country)} ${e.country}` : '–'} · {L.device(e.device)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!stats.activity.length && <p className="p-8 text-center text-sm text-zinc-500">{t.noData}</p>}
      </div>
    </section>
  );
}

