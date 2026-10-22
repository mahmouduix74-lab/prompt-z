import { useEffect, useState } from 'react';
import { AlertTriangle, Mail01, TrendUp01, Wallet02, XCircle } from '@untitledui/icons';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { Button } from '../ds/components/base/buttons/button';
import { Input } from '../ds/components/base/input/input';
import { Toggle } from '../ds/components/base/toggle/toggle';
import { FeaturedIcon } from '../ds/components/foundations/featured-icon/featured-icon';
import type { SiteSettings } from '../api';
import { api } from '../api';
import { change, domainLabel, fmt, money, percent, sourceLabel } from '../format';
import { Card, Empty, Grid, PageHeader } from '../ui';
import type { PageProps } from './common';
import { useSettings } from './useSettings';

type AlertKey = 'modelDown' | 'failRate' | 'lowBalance' | 'spike';
const ALERTS: { key: AlertKey; icon: typeof XCircle; color: 'error' | 'warning' | 'brand' | 'success'; title: string; hint: string }[] = [
  { key: 'modelDown', icon: XCircle, color: 'error', title: 'الموديل وقع', hint: 'لو كل الموديلات مش متاحة، أو كل الطلبات فشلت في آخر 10 دقايق' },
  { key: 'failRate', icon: AlertTriangle, color: 'warning', title: 'نسبة الفشل عالية', hint: 'لو أكتر من 10% من الطلبات فشلت في آخر ساعة' },
  { key: 'lowBalance', icon: Wallet02, color: 'brand', title: 'الرصيد قرب يخلص', hint: 'لما رصيد OpenRouter يوصل لدولار واحد' },
  { key: 'spike', icon: TrendUp01, color: 'success', title: 'زيارات أكتر من العادي', hint: 'لو الزوار في ساعة بقوا ضعف المتوسط' },
];
const WHEN: Record<SiteSettings['alerts']['report'], string> = {
  off: 'التقرير مقفول',
  daily: 'كل يوم الساعة 9 الصبح بتوقيت القاهرة',
  weekly: 'كل أحد الساعة 9 الصبح بتوقيت القاهرة',
  monthly: 'أول كل شهر الساعة 9 الصبح بتوقيت القاهرة',
};

export function Alerts({ stats }: PageProps) {
  const { view, draft, save, saving, error } = useSettings();
  const [to, setTo] = useState('');
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => setTo(draft?.alerts.to || ''), [draft?.alerts.to]);

  if (!view || !draft) return <Empty title={error || 'بنحمّل الإعدادات…'} />;
  const alerts = draft.alerts;
  const recipients = alerts.to ? [alerts.to] : view.envAdmins.length ? view.envAdmins : [stats.viewer];
  const setAlerts = (patch: Partial<SiteSettings['alerts']>) => save({ alerts: { ...alerts, ...patch } });

  const sendTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api.testReport());
    } catch (err) {
      setTest({ ok: false, message: String((err as Error)?.message || err) });
    } finally {
      setTesting(false);
    }
  };

  const { period, prev } = stats;
  const source = stats.breakdowns.sources[0];
  const domain = stats.breakdowns.domains[0];
  const preview: [string, number, number][] = [
    ['برومبتات', period.prompts, prev.prompts],
    ['زوار', period.visitors, prev.visitors],
    ['حسابات جديدة', period.signups, prev.signups],
  ];

  return (
    <>
      <PageHeader title="التنبيهات والتقارير" description={`بتوصلك على ${recipients.join('، ')}`} />
      {error && <p className="text-sm text-error-primary">{error}</p>}
      <Grid cols="grid-cols-1 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="تنبيهات فورية" description="بتتبعت أول ما الحاجة تحصل، ومرة واحدة كل ساعة بالكتير" bodyClassName="py-0">
            {ALERTS.map((a) => (
              <div key={a.key} className="flex items-center gap-4 border-b border-secondary py-5 last:border-b-0">
                <FeaturedIcon icon={a.icon} color={a.color} theme="light" size="md" />
                <div className="flex flex-1 flex-col">
                  <p className="text-sm font-semibold text-primary">{a.title}</p>
                  <p className="text-sm text-tertiary">{a.hint}</p>
                </div>
                <Toggle size="md" isSelected={alerts[a.key]} isDisabled={saving} onChange={(on) => setAlerts({ [a.key]: on })} aria-label={a.title} />
              </div>
            ))}
          </Card>
          <Card title="تقرير دوري" description="ملخص الأرقام في إيميل واحد" bodyClassName="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium text-secondary">كل قد إيه</span>
              <ButtonGroup
                size="sm"
                selectedKeys={[alerts.report]}
                disallowEmptySelection
                isDisabled={saving}
                onSelectionChange={(keys) => {
                  const [key] = [...keys];
                  if (key) setAlerts({ report: key as SiteSettings['alerts']['report'] });
                }}
              >
                <ButtonGroupItem id="off">مقفول</ButtonGroupItem>
                <ButtonGroupItem id="daily">يومي</ButtonGroupItem>
                <ButtonGroupItem id="weekly">أسبوعي</ButtonGroupItem>
                <ButtonGroupItem id="monthly">شهري</ButtonGroupItem>
              </ButtonGroup>
            </div>
            <p className="text-sm text-tertiary">{WHEN[alerts.report]}</p>
            <div className="flex items-end gap-3">
              <Input
                className="flex-1"
                label="يتبعت لـ"
                placeholder={view.envAdmins[0] || 'you@gmail.com'}
                hint="سيبه فاضي عشان يتبعت لإيميلات الأدمن"
                value={to}
                onChange={setTo}
                icon={Mail01}
                inputClassName="text-start"
              />
              {to.trim().toLowerCase() !== alerts.to && (
                <Button color="secondary" size="md" className="mb-6" onClick={() => setAlerts({ to: to.trim() })} isLoading={saving}>
                  حفظ
                </Button>
              )}
            </div>
          </Card>
        </div>
        <Card
          title="شكل التقرير"
          description="معاينة بأرقام الفترة اللي مختارها"
          trailing={
            <Button color="secondary" size="sm" onClick={sendTest} isLoading={testing}>
              ابعت تجربة
            </Button>
          }
        >
          {test && <p className={`mb-4 text-sm ${test.ok ? 'text-success-primary' : 'text-error-primary'}`}>{test.ok ? 'اتبعت. شوف الإيميل.' : test.message}</p>}
          <div className="flex flex-col gap-5 rounded-xl bg-secondary p-6">
            <div>
              <p className="text-xs text-tertiary" dir="ltr" style={{ textAlign: 'start' }}>
                PromptZ &lt;login@prpmtz.online&gt;
              </p>
              <p className="mt-1 text-md font-semibold text-primary">تقرير PromptZ</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {preview.map(([label, now, before]) => {
                const c = change(now, before);
                return (
                  <div key={label} className="rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                    <p className="text-xs font-medium text-tertiary">{label}</p>
                    <p className="mt-1 text-display-xs font-semibold text-primary">{fmt(now)}</p>
                    {c.change && (
                      <p className={`text-xs font-medium ${c.good ? 'text-success-primary' : 'text-error-primary'}`} dir="ltr" style={{ textAlign: 'start' }}>
                        {c.trend === 'up' ? '↑' : '↓'} {c.change}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <ul className="flex flex-col gap-2 text-sm text-secondary">
              {source && (
                <li>
                  • أكبر مصدر للزوار: {sourceLabel(source.key)} (<bdi>{percent(source.n, period.visitors)}</bdi>)
                </li>
              )}
              {domain && <li>• أكتر مجال: {domainLabel(domain.key)}</li>}
              <li>
                • نسبة النجاح <bdi>{period.calls ? percent(period.calls - period.errors, period.calls, 1) : '—'}</bdi> · الصرف <bdi>{money(period.cost)}</bdi>
              </li>
            </ul>
            <Button color="primary" size="md" className="self-start" href="/admin">
              افتح لوحة التحكم
            </Button>
          </div>
        </Card>
      </Grid>
    </>
  );
}
