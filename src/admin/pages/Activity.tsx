import { useMemo, useState } from 'react';
import { Avatar } from '../ds/components/base/avatar/avatar';
import { BadgeWithDot } from '../ds/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '../ds/components/base/button-group/button-group';
import { ago, fmt } from '../format';
import { Card, Empty, FeedItem, Grid, MetricItem, PageHeader } from '../ui';
import { describe, type PageProps } from './common';

type Filter = 'all' | 'prompts' | 'signup' | 'feedback' | 'problems';

export function ActivityPage({ stats }: PageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const { today } = stats;
  const rows = useMemo(
    () =>
      stats.activity.filter((r) => {
        if (filter === 'prompts') return r.kind === 'generate' || r.kind === 'refine';
        if (filter === 'signup' || filter === 'feedback') return r.kind === filter;
        if (filter === 'problems') return r.outcome === 'error' || r.outcome === 'limit' || r.outcome === 'invalid';
        return true;
      }),
    [stats.activity, filter]
  );

  return (
    <>
      <PageHeader title="النشاط المباشر" description="آخر حاجات حصلت على الموقع، وبتتحدث كل دقيقة" />
      <Grid cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricItem title="برومبتات النهارده" value={fmt(today.prompts)} />
        <MetricItem title="أشخاص النهارده" value={fmt(today.people)} />
        <MetricItem title="حسابات جديدة النهارده" value={fmt(today.signups)} />
        <MetricItem title="وصلوا للحد النهارده" value={fmt(today.limits)} />
      </Grid>
      <Card
        title="كل النشاط"
        badge={
          <BadgeWithDot size="sm" type="modern" color="success">
            مباشر
          </BadgeWithDot>
        }
        trailing={
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
            <ButtonGroupItem id="prompts">برومبتات</ButtonGroupItem>
            <ButtonGroupItem id="signup">تسجيل</ButtonGroupItem>
            <ButtonGroupItem id="feedback">تقييمات</ButtonGroupItem>
            <ButtonGroupItem id="problems">مشاكل</ButtonGroupItem>
          </ButtonGroup>
        }
      >
        {rows.length ? (
          <div className="flex max-w-2xl flex-col">
            {rows.map((r, i) => {
              const d = describe(r);
              return <FeedItem key={i} avatar={<Avatar size="md" initials={d.initial} />} name={d.name} text={d.text} highlight={d.highlight} time={ago(r.ts)} last={i === rows.length - 1} />;
            })}
          </div>
        ) : (
          <Empty title="مافيش نشاط هنا" />
        )}
      </Card>
    </>
  );
}
