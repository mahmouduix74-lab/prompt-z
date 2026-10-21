/**
 * The dashboard's frame: a sidebar that collapses to an icon rail (the DS "Slim" sidebar), a top
 * bar with the page name, search, theme and alerts, and the mobile header with its menu.
 */
import { useEffect, useRef, type FC, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowNarrowLeft,
  Bell01,
  ChevronLeftDouble,
  ChevronRightDouble,
  CoinsStacked01,
  Globe01,
  HomeLine,
  Link01,
  LogOut01,
  MessageChatCircle,
  Moon01,
  PieChart03,
  SearchLg,
  Settings01,
  Sun,
  Users01,
} from '@untitledui/icons';
import { MobileNavigationHeader } from './ds/components/application/app-navigation/base-components/mobile-header';
import { NavAccountCard } from './ds/components/application/app-navigation/base-components/nav-account-card';
import { NavItemButton } from './ds/components/application/app-navigation/base-components/nav-item-button';
import { NavList } from './ds/components/application/app-navigation/base-components/nav-list';
import type { NavItemDividerType, NavItemType } from './ds/components/application/app-navigation/config';
import { Avatar } from './ds/components/base/avatar/avatar';
import { Badge } from './ds/components/base/badges/badges';
import { ButtonUtility } from './ds/components/base/buttons/button-utility';
import { Input } from './ds/components/base/input/input';
import { cx } from './ds/utils/cx';

export type PageId = 'overview' | 'users' | 'traffic' | 'links' | 'quality' | 'feedback' | 'activity' | 'costs' | 'errors' | 'alerts' | 'settings';

export const PAGE_IDS: PageId[] = ['overview', 'users', 'traffic', 'links', 'quality', 'feedback', 'activity', 'costs', 'errors', 'alerts', 'settings'];

export const pageHref = (page: PageId) => (page === 'overview' ? '/admin' : `/admin/${page}`);

type Icon = FC<{ className?: string }>;
const PAGES: { id: PageId; label: string; icon: Icon; group: 1 | 2 }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: HomeLine, group: 1 },
  { id: 'users', label: 'المستخدمين', icon: Users01, group: 1 },
  { id: 'traffic', label: 'الزيارات', icon: Globe01, group: 1 },
  { id: 'links', label: 'لينكات الحملات', icon: Link01, group: 1 },
  { id: 'quality', label: 'الجودة والاستخدام', icon: PieChart03, group: 1 },
  { id: 'feedback', label: 'التقييمات', icon: MessageChatCircle, group: 1 },
  { id: 'activity', label: 'النشاط المباشر', icon: Activity, group: 1 },
  { id: 'costs', label: 'التكلفة والرصيد', icon: CoinsStacked01, group: 2 },
  { id: 'errors', label: 'الأخطاء', icon: AlertCircle, group: 2 },
  { id: 'alerts', label: 'التنبيهات والتقارير', icon: Bell01, group: 2 },
  { id: 'settings', label: 'الإعدادات', icon: Settings01, group: 2 },
];
export const pageLabel = (id: PageId) => PAGES.find((p) => p.id === id)?.label || '';

const count = (n: number | undefined, color: 'gray' | 'error' = 'gray') =>
  n ? (
    <Badge size="sm" type={color === 'error' ? 'pill-color' : 'modern'} color={color}>
      {n.toLocaleString('en-US')}
    </Badge>
  ) : undefined;

export interface NavCounts {
  users?: number;
  feedback?: number;
  errors?: number;
}

const navItems = (counts: NavCounts): (NavItemType | NavItemDividerType)[] => {
  const badge: Partial<Record<PageId, ReactNode>> = { users: count(counts.users), feedback: count(counts.feedback), errors: count(counts.errors, 'error') };
  const item = (p: (typeof PAGES)[number]): NavItemType => ({ label: p.label, href: pageHref(p.id), icon: p.icon, badge: badge[p.id] });
  return [...PAGES.filter((p) => p.group === 1).map(item), { divider: true }, ...PAGES.filter((p) => p.group === 2).map(item)];
};

export const Logo = ({ compact }: { compact?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <img src="/promptz-icon.svg" alt="PromptZ" className="size-8 rounded-lg" />
    {!compact && (
      <>
        <span className="text-md font-semibold text-primary" dir="ltr">
          PromptZ
        </span>
        <Badge size="sm" type="color" color="brand">
          Admin
        </Badge>
      </>
    )}
  </div>
);

export interface ShellProps {
  page: PageId;
  counts: NavCounts;
  user: { name: string; email: string; picture?: string };
  dark: boolean;
  onToggleDark: () => void;
  onSearch: (query: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: ReactNode;
}

const accountActions = (dark: boolean, onToggleDark: () => void) => [
  { label: dark ? 'الوضع الفاتح' : 'الوضع الداكن', icon: dark ? Sun : Moon01, onPress: onToggleDark },
  { label: 'الرجوع للموقع', icon: ArrowNarrowLeft, href: '/' },
  { label: 'تسجيل الخروج', icon: LogOut01, href: '/api/auth/logout' },
];

/** The open sidebar: logo, pages with counts, and the account card. */
const SidebarOpen = ({ page, counts, user, dark, onToggleDark }: Omit<ShellProps, 'children' | 'onSearch' | 'collapsed' | 'onToggleCollapsed'>) => (
  <div className="flex h-full w-full flex-col justify-between overflow-auto bg-primary pt-5">
    <div className="px-5">
      <Logo />
    </div>
    <NavList activeUrl={pageHref(page)} items={navItems(counts)} />
    <div className="mt-auto px-4 py-4">
      <NavAccountCard
        selectedAccountId="me"
        popoverPlacement="top"
        items={[{ id: 'me', name: user.name || user.email, email: user.email, avatar: user.picture || '', status: 'online' }]}
        actions={accountActions(dark, onToggleDark)}
      />
    </div>
  </div>
);

/** The collapsed sidebar: the DS slim rail, icons with their names in tooltips. */
const SidebarRail = ({ page, counts, user }: Pick<ShellProps, 'page' | 'counts' | 'user'>) => (
  <div className="flex h-full w-full flex-col items-center justify-between overflow-auto bg-primary py-5">
    <div className="flex flex-col items-center gap-5">
      <Logo compact />
      <nav className="flex flex-col items-center gap-0.5">
        {PAGES.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center">
            {i > 0 && PAGES[i - 1].group !== p.group && <hr className="my-2 w-8 border-secondary" />}
            <NavItemButton
              label={p.label}
              icon={p.icon}
              href={pageHref(p.id)}
              current={page === p.id}
              tooltipPlacement="left"
              dot={p.id === 'errors' && Boolean(counts.errors)}
            />
          </div>
        ))}
      </nav>
    </div>
    <Avatar size="md" initials={(user.name || user.email).charAt(0).toUpperCase()} src={user.picture || undefined} status="online" />
  </div>
);

/** The top bar: collapse button, where you are, search, theme and the errors bell. */
const TopBar = ({ page, counts, dark, onToggleDark, onSearch, collapsed, onToggleCollapsed }: Omit<ShellProps, 'children' | 'user'>) => {
  const search = useRef<HTMLInputElement>(null);
  // ⌘K / Ctrl+K focuses the search, as its shortcut badge says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-secondary bg-primary/90 px-6 backdrop-blur-md lg:flex">
      <ButtonUtility
        size="sm"
        color="tertiary"
        tooltip={collapsed ? 'افتح القايمة' : 'اقفل القايمة'}
        icon={collapsed ? ChevronLeftDouble : ChevronRightDouble}
        onClick={onToggleCollapsed}
      />
      <span className="h-5 w-px bg-border-secondary" />
      <p className="flex items-center gap-2 text-sm">
        <span className="font-medium text-tertiary">لوحة التحكم</span>
        <span className="text-quaternary">/</span>
        <span className="font-semibold text-primary">{pageLabel(page)}</span>
      </p>
      <div className="ms-auto flex items-center gap-2">
        <div className="w-64">
          <Input
            ref={search}
            shortcut
            size="sm"
            aria-label="ابحث عن مستخدم"
            placeholder="ابحث عن مستخدم"
            icon={SearchLg}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch((e.target as HTMLInputElement).value.trim());
            }}
          />
        </div>
        <ButtonUtility size="sm" color="tertiary" tooltip={dark ? 'الوضع الفاتح' : 'الوضع الداكن'} icon={dark ? Sun : Moon01} onClick={onToggleDark} />
        <div className="relative">
          <ButtonUtility size="sm" color="tertiary" tooltip={counts.errors ? `${counts.errors} خطأ في آخر 24 ساعة` : 'مافيش أخطاء'} icon={Bell01} href={pageHref('errors')} />
          {Boolean(counts.errors) && <span className="pointer-events-none absolute top-1.5 end-1.5 size-2 rounded-full bg-fg-error-primary ring-2 ring-bg-primary" />}
        </div>
      </div>
    </header>
  );
};

export const Shell = ({ children, ...props }: ShellProps) => (
  <div className="min-h-screen bg-primary lg:flex">
    {/* Remounted on every page change, so the mobile menu closes after picking a page. */}
    <MobileNavigationHeader key={props.page} logo={<Logo />}>
      <SidebarOpen {...props} />
    </MobileNavigationHeader>
    <aside
      className={cx(
        'sticky top-0 hidden h-screen shrink-0 border-e border-secondary bg-primary transition-[width] duration-200 ease-out lg:block',
        props.collapsed ? 'w-[68px]' : 'w-[280px]'
      )}
    >
      {props.collapsed ? <SidebarRail {...props} /> : <SidebarOpen {...props} />}
    </aside>
    <div className="min-w-0 flex-1">
      <TopBar {...props} />
      <main className="pt-6 pb-10 lg:pt-8 lg:pb-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 lg:gap-8 lg:px-8">{children}</div>
      </main>
    </div>
  </div>
);
