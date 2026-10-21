/** The dashboard's frame: the DS sidebar (desktop) and mobile header around the current page. */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowNarrowLeft,
  Bell01,
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
import { NavList } from './ds/components/application/app-navigation/base-components/nav-list';
import type { NavItemDividerType, NavItemType } from './ds/components/application/app-navigation/config';
import { Badge } from './ds/components/base/badges/badges';
import { Input } from './ds/components/base/input/input';

export type PageId = 'overview' | 'users' | 'traffic' | 'links' | 'quality' | 'feedback' | 'activity' | 'costs' | 'errors' | 'alerts' | 'settings';

export const PAGE_IDS: PageId[] = ['overview', 'users', 'traffic', 'links', 'quality', 'feedback', 'activity', 'costs', 'errors', 'alerts', 'settings'];

export const pageHref = (page: PageId) => (page === 'overview' ? '/admin' : `/admin/${page}`);

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

const navItems = (counts: NavCounts): (NavItemType | NavItemDividerType)[] => [
  { label: 'نظرة عامة', href: pageHref('overview'), icon: HomeLine },
  { label: 'المستخدمين', href: pageHref('users'), icon: Users01, badge: count(counts.users) },
  { label: 'الزيارات', href: pageHref('traffic'), icon: Globe01 },
  { label: 'لينكات الحملات', href: pageHref('links'), icon: Link01 },
  { label: 'الجودة والاستخدام', href: pageHref('quality'), icon: PieChart03 },
  { label: 'التقييمات', href: pageHref('feedback'), icon: MessageChatCircle, badge: count(counts.feedback) },
  { label: 'النشاط المباشر', href: pageHref('activity'), icon: Activity },
  { divider: true },
  { label: 'التكلفة والرصيد', href: pageHref('costs'), icon: CoinsStacked01 },
  { label: 'الأخطاء', href: pageHref('errors'), icon: AlertCircle, badge: count(counts.errors, 'error') },
  { label: 'التنبيهات والتقارير', href: pageHref('alerts'), icon: Bell01 },
  { label: 'الإعدادات', href: pageHref('settings'), icon: Settings01 },
];

export const Logo = () => (
  <div className="flex items-center gap-2.5">
    <img src="/promptz-icon.svg" alt="" className="size-8 rounded-lg" />
    <span className="text-md font-semibold text-primary" dir="ltr">
      PromptZ
    </span>
    <Badge size="sm" type="color" color="brand">
      Admin
    </Badge>
  </div>
);

export interface ShellProps {
  page: PageId;
  counts: NavCounts;
  user: { name: string; email: string; picture?: string };
  dark: boolean;
  onToggleDark: () => void;
  onSearch: (query: string) => void;
  children: ReactNode;
}

/** Same markup as the DS SidebarNavigationSectionDividers, with the PromptZ logo and pages. */
const SidebarContent = ({ page, counts, user, dark, onToggleDark, onSearch }: Omit<ShellProps, 'children'>) => {
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
    <aside className="flex h-full w-full max-w-full flex-col justify-between overflow-auto bg-primary pt-4 shadow-xs ring-secondary ring-inset lg:rounded-xl lg:pt-5 lg:ring-1">
      <div className="flex flex-col gap-5 px-4 lg:px-5">
        <Logo />
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
      <NavList activeUrl={pageHref(page)} items={navItems(counts)} />
      <div className="mt-auto flex flex-col gap-5 px-2 py-4 lg:gap-6 lg:px-4 lg:py-4">
        <NavAccountCard
          selectedAccountId="me"
          popoverPlacement="top"
          items={[{ id: 'me', name: user.name || user.email, email: user.email, avatar: user.picture || '', status: 'online' }]}
          actions={[
            { label: dark ? 'الوضع الفاتح' : 'الوضع الداكن', icon: dark ? Sun : Moon01, onPress: onToggleDark },
            { label: 'الرجوع للموقع', icon: ArrowNarrowLeft, href: '/' },
            { label: 'تسجيل الخروج', icon: LogOut01, href: '/api/auth/logout' },
          ]}
        />
      </div>
    </aside>
  );
};

export const Shell = ({ children, ...props }: ShellProps) => (
  <div className="min-h-screen bg-primary lg:flex lg:bg-secondary_alt">
    {/* Remounted on every page change, so the mobile menu closes after picking a page. */}
    <MobileNavigationHeader key={props.page} logo={<Logo />}>
      <SidebarContent {...props} />
    </MobileNavigationHeader>
    <div className="sticky top-0 hidden h-screen shrink-0 py-1 ps-1 lg:flex">
      <div className="w-[276px]">
        <SidebarContent {...props} />
      </div>
    </div>
    <main className="min-w-0 flex-1 bg-primary pt-6 pb-10 lg:pt-8 lg:pb-12">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 lg:gap-8 lg:px-8">{children}</div>
    </main>
  </div>
);
