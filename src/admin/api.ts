/** The dashboard's calls to /api/admin/* (src/server/admin.ts) and the shapes they return. */

export type Row = Record<string, any>;
export type Count = { key: string; n: number };

export interface Totals {
  prompts: number;
  enhanced: number;
  clarify: number;
  answered: number;
  errors: number;
  calls: number;
  limits: number;
  signedInPrompts: number;
  people: number;
  accounts: number;
  cost: number;
  avgMs: number | null;
  visitors: number;
  visits: number;
  signups: number;
  returning?: number;
}

export interface Stats {
  generatedAt: string;
  viewer: string;
  range: { days: number; start: string; end: string; prevStart: string; prevEnd: string };
  trackingSince: { events: string | null; visits: string | null };
  limits: { anonymous: number; signedIn: number };
  users: { total: number; activeToday: number; retention: { active: number; returned: number } };
  period: Totals;
  prev: Totals;
  today: Totals;
  daily: Row[];
  dailyVisits: Row[];
  signups: Row[];
  /** Prompts made by UTC weekday (0 = Sunday) and hour. */
  hours: { dow: number; hour: number; n: number }[];
  last24: { ago: number; errors: number; calls: number }[];
  models: { model: string; n: number; success: number; median: number | null; p95: number | null }[];
  costByDepth: { key: string; avg: number; n: number }[];
  breakdowns: Record<'domains' | 'depths' | 'languages' | 'countries' | 'devices' | 'sources', Count[]>;
  campaigns: { slug: string; name: string; platform: string; created: string; visitors: number; made: number }[];
  errors: Row[];
  errorTypes: Count[];
  feedback: { totals: Row; byDomain: { key: string; up: number; n: number }[]; recent: Row[] };
  userList: Row[];
  activity: Row[];
}

export interface SiteSettings {
  limits: { anonymous: number; signedIn: number };
  refineCounts: boolean;
  maxChars: number;
  clarify: boolean;
  models: string[];
  defaultDepth: string;
  extraAdmins: string[];
  alerts: { modelDown: boolean; failRate: boolean; lowBalance: boolean; spike: boolean; report: 'off' | 'daily' | 'weekly' | 'monthly'; to: string };
}

export interface SettingsView {
  settings: SiteSettings;
  bounds: { anonymous: [number, number]; signedIn: [number, number]; maxChars: [number, number] };
  knownModels: string[];
  envAdmins: string[];
  limitHits: { anonymous: number; signedIn: number };
  audit: { ts: string; admin: string | null; action: string; detail: any }[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: any
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || `HTTP ${res.status}`, data);
  return data as T;
}

export const api = {
  stats: (days: number) => call<Stats>(`stats?days=${days}`),
  user: (email: string) => call<{ email: string; daily: { day: string; n: number }[]; domains: Count[]; totals: Row }>(`user?email=${encodeURIComponent(email)}`),
  deleteUser: (email: string) => call<{ ok: true }>('delete-user', { email }),
  settings: () => call<SettingsView>('settings'),
  saveSettings: (patch: Partial<SiteSettings>) => call<SettingsView>('settings', patch),
  saveCampaign: (c: { slug: string; name: string; platform: string }) => call<{ ok: true }>('campaigns', { action: 'save', ...c }),
  deleteCampaign: (slug: string) => call<{ ok: true }>('campaigns', { action: 'delete', slug }),
  balance: () => call<{ total: number; used: number; remaining: number; unavailable?: boolean }>('balance'),
  models: () => call<{ models: { model: string; available: boolean }[] }>('models'),
  testReport: () => call<{ ok: boolean; message: string }>('test-report', {}),
};
