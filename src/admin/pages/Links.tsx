import { useState } from 'react';
import { Check, Copy01, Edit01, Plus, Trash01 } from '@untitledui/icons';
import { Table, TableCard } from '../ds/components/application/table/table';
import { Badge } from '../ds/components/base/badges/badges';
import { Button } from '../ds/components/base/buttons/button';
import { ButtonUtility } from '../ds/components/base/buttons/button-utility';
import { Input } from '../ds/components/base/input/input';
import { Select } from '../ds/components/base/select/select';
import { api } from '../api';
import { dateLabel, fmt, percent, PLATFORMS, sourceLabel } from '../format';
import { Card, ConfirmDialog, Empty, PageHeader } from '../ui';
import { periodName, type PageProps } from './common';

const SITE = 'prpmtz.online';
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** A link code from the name: Latin letters and digits, or a short random code for Arabic names. */
function slugFrom(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return latin || `link-${Math.random().toString(36).slice(2, 7)}`;
}

export function Links({ stats, days, reload }: PageProps) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<string>('instagram');
  const [slug, setSlug] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const code = slug || (name ? slugFrom(name) : '');
  const url = (c: string) => `${SITE}/?c=${c}`;
  const best = [...stats.campaigns].filter((c) => c.visitors >= 5).sort((a, b) => b.made / b.visitors - a.made / a.visitors)[0];

  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(`https://${url(c)}`);
      setCopied(c);
      setTimeout(() => setCopied((v) => (v === c ? null : v)), 1500);
    } catch {
      // The clipboard can be blocked; the link is on screen to copy by hand.
    }
  };

  const save = async () => {
    setError('');
    if (!name.trim()) return setError('اكتب اسم للحملة.');
    if (!SLUG.test(code)) return setError('كود اللينك حروف إنجليزي صغيرة وأرقام وشَرطة بس.');
    if (!editing && stats.campaigns.some((c) => c.slug === code)) return setError('الكود ده مستخدم في حملة تانية.');
    setSaving(true);
    try {
      await api.saveCampaign({ slug: code, name: name.trim(), platform });
      setName('');
      setSlug('');
      setEditing(null);
      await reload();
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.deleteCampaign(deleting);
      setDeleting(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="لينكات الحملات" description="لينك مخصوص لكل بوست أو إعلان، عشان تعرف كل واحد جاب كام زائر وكام واحد منهم استخدم الموقع" />
      <Card title={editing ? 'تعديل الحملة' : 'لينك جديد'} trailing={editing ? <Button color="link-gray" size="sm" onClick={() => (setEditing(null), setName(''), setSlug(''))}>إلغاء التعديل</Button> : undefined}>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_200px_1.3fr_auto]">
          <Input label="الاسم" placeholder="مثلًا: بوست انستجرام · الريلز" value={name} onChange={setName} />
          <Select label="المنصة" selectedKey={platform} onSelectionChange={(k) => setPlatform(String(k))} items={PLATFORMS.map((p) => ({ id: p, label: sourceLabel(p) }))}>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
          <Input
            label="كود اللينك"
            placeholder="ig-reels"
            value={code}
            onChange={(v) => setSlug(v.toLowerCase())}
            isReadOnly={Boolean(editing)}
            hint={code ? url(code) : 'بيتعمل من الاسم، وتقدر تغيّره'}
            inputClassName="font-mono"
          />
          <Button color="primary" size="md" iconLeading={editing ? Check : Plus} className="md:mt-6" onClick={save} isLoading={saving}>
            {editing ? 'حفظ' : 'إنشاء'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-error-primary">{error}</p>}
      </Card>
      <TableCard.Root>
        <TableCard.Header
          title="كل الحملات"
          badge={`${fmt(stats.campaigns.length)} لينك`}
          description={best ? `أحسن لينك في التحويل: ${best.name} (${percent(best.made, best.visitors)}) · ${periodName(days)}` : periodName(days)}
        />
        {stats.campaigns.length ? (
          <Table aria-label="الحملات">
            <Table.Header>
              <Table.Head id="name" label="الحملة" isRowHeader className="w-full" />
              <Table.Head id="link" label="اللينك" />
              <Table.Head id="v" label="زوار" />
              <Table.Head id="p" label="استخدموا الموقع" />
              <Table.Head id="c" label="التحويل" />
              <Table.Head id="d" label="اتعمل" />
              <Table.Head id="a" />
            </Table.Header>
            <Table.Body items={stats.campaigns.map((c) => ({ id: c.slug, c }))}>
              {({ c }) => (
                <Table.Row id={c.slug}>
                  <Table.Cell>
                    <div className="whitespace-nowrap">
                      <p className="text-sm font-medium text-primary">{c.name}</p>
                      <p className="text-sm text-tertiary">{sourceLabel(c.platform)}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-mono whitespace-nowrap" dir="ltr">
                    ?c={c.slug}
                  </Table.Cell>
                  <Table.Cell className="font-medium text-primary">{fmt(c.visitors)}</Table.Cell>
                  <Table.Cell>{fmt(c.made)}</Table.Cell>
                  <Table.Cell>
                    <Badge size="sm" type="pill-color" color={c.visitors && c.made / c.visitors >= 0.3 ? 'success' : 'gray'}>
                      {percent(c.made, c.visitors)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">{dateLabel(c.created)}</Table.Cell>
                  <Table.Cell className="px-4">
                    <div className="flex justify-end gap-0.5">
                      <ButtonUtility size="xs" color="tertiary" tooltip={copied === c.slug ? 'اتنسخ' : 'نسخ اللينك'} icon={copied === c.slug ? Check : Copy01} onClick={() => copy(c.slug)} />
                      <ButtonUtility
                        size="xs"
                        color="tertiary"
                        tooltip="تعديل"
                        icon={Edit01}
                        onClick={() => {
                          setEditing(c.slug);
                          setName(c.name);
                          setPlatform(c.platform);
                          setSlug(c.slug);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                      <ButtonUtility size="xs" color="tertiary" tooltip="حذف" icon={Trash01} onClick={() => setDeleting(c.slug)} />
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        ) : (
          <Empty title="لسه مافيش لينكات" description="اعمل لينك لكل بوست، وحطه في البايو أو في الإعلان." />
        )}
      </TableCard.Root>
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="حذف اللينك؟"
        description="الزيارات اللي جت منه هتفضل محسوبة في الزيارات، بس اللينك نفسه هيبطل يتحسب كحملة."
        confirmLabel="حذف"
        onConfirm={remove}
        busy={saving}
      />
    </>
  );
}
