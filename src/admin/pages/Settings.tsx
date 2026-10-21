import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Trash01, UserPlus01 } from '@untitledui/icons';
import { Table, TableCard } from '../ds/components/application/table/table';
import { Tabs } from '../ds/components/application/tabs/tabs';
import { Avatar } from '../ds/components/base/avatar/avatar';
import { Badge, BadgeWithDot } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import { ButtonUtility } from '../ds/components/base/buttons/button-utility';
import { Input } from '../ds/components/base/input/input';
import { InputNumber } from '../ds/components/base/input/input-number';
import { Toggle } from '../ds/components/base/toggle/toggle';
import { api, type SiteSettings } from '../api';
import { ago, dateLabel, depthLabel, fmt } from '../format';
import { Card, Empty, PageHeader } from '../ui';
import type { PageProps } from './common';
import { useSettings } from './useSettings';

type Section = 'limits' | 'ai' | 'admins' | 'log';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'limits', label: 'الحدود والاستخدام' },
  { id: 'ai', label: 'الذكاء الاصطناعي' },
  { id: 'admins', label: 'الأدمن' },
  { id: 'log', label: 'سجل التغييرات' },
];

const DEPTHS = ['short', 'medium', 'detailed', 'ultra'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SettingRow = ({ title, hint, control }: { title: string; hint?: ReactNode; control: ReactNode }) => (
  <div className="flex flex-col gap-4 border-b border-secondary py-5 last:border-b-0 md:flex-row md:items-center md:gap-8">
    <div className="flex flex-1 flex-col">
      <p className="text-sm font-semibold text-secondary">{title}</p>
      {hint && <p className="text-sm text-tertiary">{hint}</p>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

/** A change log entry in words. */
function describeChange(action: string, detail: any): string {
  const names: Record<string, string> = {
    'settings.limits': 'الحدود اليومية',
    'settings.refineCounts': '«تحسين الصياغة» بيتحسب من الحد',
    'settings.maxChars': 'أقصى طول للطلب',
    'settings.clarify': 'الأسئلة التوضيحية',
    'settings.models': 'ترتيب الموديلات',
    'settings.defaultDepth': 'مستوى التفصيل الافتراضي',
    'settings.extraAdmins': 'الأدمن',
    'settings.alerts': 'التنبيهات والتقارير',
    'user.delete': 'حذف حساب',
    'campaign.save': 'حفظ لينك حملة',
    'campaign.delete': 'حذف لينك حملة',
  };
  const value = (v: any): string => {
    if (typeof v === 'boolean') return v ? 'شغال' : 'مقفول';
    if (typeof v === 'number') return fmt(v);
    if (Array.isArray(v)) return v.join('، ') || '—';
    if (v && typeof v === 'object' && 'anonymous' in v) return `زوار ${v.anonymous} · حسابات ${v.signedIn}`;
    if (DEPTHS.includes(v)) return depthLabel(v);
    return v == null ? '—' : typeof v === 'object' ? '' : String(v);
  };
  const name = names[action] || action;
  if (detail && 'from' in detail && action !== 'settings.alerts') return `${name}: ${value(detail.from)} ← ${value(detail.to)}`;
  if (detail?.email) return `${name}: ${detail.email}`;
  if (detail?.slug) return `${name}: ${detail.name || detail.slug}`;
  return name;
}

export function Settings(_: PageProps) {
  const { view, draft, setDraft, dirty, save, saving, error, reset } = useSettings();
  const [section, setSection] = useState<Section>('limits');
  const [models, setModels] = useState<Record<string, boolean> | null>(null);
  const [checking, setChecking] = useState(false);
  const [newAdmin, setNewAdmin] = useState('');
  const [saved, setSaved] = useState(false);

  const checkModels = async () => {
    setChecking(true);
    try {
      const r = await api.models();
      setModels(Object.fromEntries(r.models.map((m) => [m.model, m.available])));
    } catch {
      setModels({});
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    checkModels();
  }, []);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (!view || !draft) return <Empty title={error || 'بنحمّل الإعدادات…'} />;
  const set = (patch: Partial<SiteSettings>) => setDraft({ ...draft, ...patch });
  const move = (i: number, by: number) => {
    const list = [...draft.models];
    [list[i], list[i + by]] = [list[i + by], list[i]];
    set({ models: list });
  };
  const addAdmin = () => {
    const email = newAdmin.trim().toLowerCase();
    if (!EMAIL.test(email) || view.envAdmins.includes(email) || draft.extraAdmins.includes(email)) return;
    set({ extraAdmins: [...draft.extraAdmins, email] });
    setNewAdmin('');
  };
  const admins = [...view.envAdmins.map((e) => ({ id: e, email: e, source: 'cf' as const })), ...draft.extraAdmins.map((e) => ({ id: e, email: e, source: 'db' as const }))];

  return (
    <>
      <PageHeader
        title="الإعدادات"
        description="أي تغيير بيشتغل على الموقع خلال 30 ثانية، من غير نشر جديد"
        actions={
          <>
            <Button color="secondary" size="md" onClick={reset} isDisabled={!dirty || saving}>
              إلغاء
            </Button>
            <Button color="primary" size="md" iconLeading={Check} isDisabled={!dirty} isLoading={saving} onClick={async () => setSaved(await save())}>
              {saved && !dirty ? 'اتحفظ' : 'حفظ التغييرات'}
            </Button>
          </>
        }
      />
      {error && <p className="text-sm text-error-primary">{error}</p>}
      <div className="flex flex-col gap-8 lg:flex-row">
        <Tabs orientation="vertical" selectedKey={section} onSelectionChange={(k) => setSection(k as Section)} className="shrink-0 lg:w-56">
          <Tabs.List type="line" items={SECTIONS}>
            {(t) => <Tabs.Item {...t} />}
          </Tabs.List>
        </Tabs>
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {section === 'limits' && (
            <Card title="الحدود والاستخدام" description="مين يقدر يعمل كام برومبت في اليوم" bodyClassName="py-0">
              <SettingRow
                title="حد الزوار من غير تسجيل"
                hint={`برومبتات في اليوم لكل زائر · آخر 30 يوم: ${fmt(view.limitHits.anonymous)} وصلوا للحد`}
                control={
                  <InputNumber
                    size="sm"
                    value={draft.limits.anonymous}
                    minValue={view.bounds.anonymous[0]}
                    maxValue={view.bounds.anonymous[1]}
                    onChange={(v) => Number.isFinite(v) && set({ limits: { ...draft.limits, anonymous: v } })}
                    aria-label="حد الزوار"
                    className="w-36"
                  />
                }
              />
              <SettingRow
                title="حد الحسابات المسجلة"
                hint={`برومبتات في اليوم لكل حساب · آخر 30 يوم: ${fmt(view.limitHits.signedIn)} وصلوا للحد`}
                control={
                  <InputNumber
                    size="sm"
                    value={draft.limits.signedIn}
                    minValue={view.bounds.signedIn[0]}
                    maxValue={view.bounds.signedIn[1]}
                    onChange={(v) => Number.isFinite(v) && set({ limits: { ...draft.limits, signedIn: v } })}
                    aria-label="حد الحسابات"
                    className="w-36"
                  />
                }
              />
              <SettingRow
                title="«تحسين الصياغة» بيتحسب من الحد"
                hint="لو قفلتها، تحسين الصياغة يبقى مجاني"
                control={<Toggle size="md" isSelected={draft.refineCounts} onChange={(v) => set({ refineCounts: v })} aria-label="تحسين الصياغة بيتحسب" />}
              />
              <SettingRow
                title="أقصى طول للطلب"
                hint="عدد الحروف في الطلب الواحد"
                control={
                  <InputNumber
                    size="sm"
                    value={draft.maxChars}
                    step={500}
                    minValue={view.bounds.maxChars[0]}
                    maxValue={view.bounds.maxChars[1]}
                    onChange={(v) => Number.isFinite(v) && set({ maxChars: v })}
                    aria-label="أقصى طول"
                    className="w-36"
                  />
                }
              />
            </Card>
          )}
          {section === 'ai' && (
            <Card title="الذكاء الاصطناعي" description="الموديلات وطريقة التوليد" bodyClassName="py-0">
              <SettingRow
                title="ترتيب الموديلات"
                hint="الموقع بيستخدم الأول، ولو مش متاح بينقل للتاني"
                control={
                  <div className="flex flex-col gap-2">
                    {draft.models.map((m, i) => (
                      <div key={m} className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-secondary ring-inset">
                        <span className="text-sm text-quaternary">{i + 1}</span>
                        <span className="flex-1 text-sm font-medium text-primary" dir="ltr">
                          {m}
                        </span>
                        {models && (
                          <BadgeWithDot size="sm" type="modern" color={models[m] ? 'success' : 'error'}>
                            {models[m] ? 'متاح' : 'مش متاح'}
                          </BadgeWithDot>
                        )}
                        <ButtonUtility size="xs" color="tertiary" tooltip="لفوق" icon={ArrowUp} isDisabled={i === 0} onClick={() => move(i, -1)} />
                        <ButtonUtility size="xs" color="tertiary" tooltip="لتحت" icon={ArrowDown} isDisabled={i === draft.models.length - 1} onClick={() => move(i, 1)} />
                      </div>
                    ))}
                    <Button color="link-color" size="sm" className="self-start" onClick={checkModels} isLoading={checking}>
                      اختبار الموديلات
                    </Button>
                  </div>
                }
              />
              <SettingRow
                title="الأسئلة التوضيحية"
                hint="لو الطلب ناقص تفاصيل، الموديل يسأل الأول"
                control={<Toggle size="md" isSelected={draft.clarify} onChange={(v) => set({ clarify: v })} aria-label="الأسئلة التوضيحية" />}
              />
              <SettingRow
                title="مستوى التفصيل الافتراضي"
                hint="للزوار اللي لسه ما اختاروش مستوى"
                control={
                  <ButtonGroup
                    size="sm"
                    selectedKeys={[draft.defaultDepth]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => {
                      const [key] = [...keys];
                      if (key) set({ defaultDepth: String(key) });
                    }}
                  >
                    {DEPTHS.map((d) => (
                      <ButtonGroupItem key={d} id={d}>
                        {depthLabel(d)}
                      </ButtonGroupItem>
                    ))}
                  </ButtonGroup>
                }
              />
            </Card>
          )}
          {section === 'admins' && (
            <TableCard.Root>
              <TableCard.Header
                title="الأدمن"
                description="الإيميلات اللي تقدر تفتح لوحة التحكم"
                contentTrailing={
                  <div className="flex w-full items-center gap-2 md:w-auto">
                    <Input size="sm" placeholder="email@example.com" aria-label="إيميل الأدمن" value={newAdmin} onChange={setNewAdmin} className="flex-1 md:w-60" inputClassName="text-start" />
                    <Button color="secondary" size="sm" iconLeading={UserPlus01} onClick={addAdmin} isDisabled={!EMAIL.test(newAdmin.trim())}>
                      إضافة
                    </Button>
                  </div>
                }
              />
              <Table aria-label="الأدمن">
                <Table.Header>
                  <Table.Head id="e" label="الإيميل" isRowHeader className="w-full" />
                  <Table.Head id="s" label="المصدر" />
                  <Table.Head id="a" />
                </Table.Header>
                <Table.Body items={admins}>
                  {(r) => (
                    <Table.Row id={r.id}>
                      <Table.Cell>
                        <div className="flex items-center gap-3">
                          <Avatar size="sm" initials={r.email[0].toUpperCase()} />
                          <span className="text-sm font-medium text-primary" dir="ltr">
                            {r.email}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="sm" color={r.source === 'cf' ? 'gray' : 'brand'}>
                          {r.source === 'cf' ? 'من Cloudflare' : 'اتضاف من هنا'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        {r.source === 'db' ? (
                          <ButtonUtility size="xs" color="tertiary" tooltip="شيل" icon={Trash01} onClick={() => set({ extraAdmins: draft.extraAdmins.filter((e) => e !== r.email) })} />
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
              <p className="border-t border-secondary px-4 py-3 text-sm text-tertiary md:px-6">إيميلات Cloudflare بتتغيّر من ADMIN_EMAILS في إعدادات Cloudflare. اللي بتضيفه هنا بيقدر يفتح اللوحة ويغيّر الإعدادات.</p>
            </TableCard.Root>
          )}
          {section === 'log' && (
            <TableCard.Root>
              <TableCard.Header title="سجل التغييرات" description="مين غيّر إيه، وإمتى" />
              {view.audit.length ? (
                <Table aria-label="سجل التغييرات">
                  <Table.Header>
                    <Table.Head id="w" label="التغيير" isRowHeader className="w-full" />
                    <Table.Head id="a" label="مين" />
                    <Table.Head id="t" label="إمتى" />
                  </Table.Header>
                  <Table.Body items={view.audit.map((r, i) => ({ ...r, id: String(i) }))}>
                    {(r) => (
                      <Table.Row id={r.id}>
                        <Table.Cell className="text-secondary">{describeChange(r.action, r.detail)}</Table.Cell>
                        <Table.Cell className="whitespace-nowrap" dir="ltr">
                          {r.admin || '—'}
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap" title={dateLabel(r.ts)}>
                          {ago(r.ts)}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              ) : (
                <Empty title="لسه مافيش تغييرات" />
              )}
            </TableCard.Root>
          )}
        </div>
      </div>
    </>
  );
}
