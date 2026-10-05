'use client';

import {
  BarChart,
  type BarDatum,
  BarList,
  ChartHero,
  ChartLegend,
  ChartRow,
  type ChartSeries,
  LineChart,
  type LinePoint,
  RingChart,
} from '@oppenheimer/design-system-web/charts';
import { BotIcon, UserIcon } from '@oppenheimer/design-system-web/icons';
import { PageHeader, PageHeaderMeta, PageHeaderRow } from '@oppenheimer/design-system-web/page-header';
import { Panel, PanelGrid } from '@oppenheimer/design-system-web/panel';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import { StatCard, StatDelta } from '@oppenheimer/design-system-web/stat-card';
import * as React from 'react';

const SERIES: ChartSeries[] = [
  { key: 'created', label: 'Created', tone: 'chart-1' },
  { key: 'merged', label: 'Merged', tone: 'chart-2' },
];

/** A month of days, Sep 5 to Oct 4, from a fixed seed so the prerender and the browser agree. */
const DAYS: BarDatum[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 8, 5 + i);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const wave = (n: number) => Math.round(((Math.sin(i * 1.7 + n) + 1.4) * (weekend ? 2 : 6)) % 13) + 1;
  return {
    key: `d${i}`,
    label: String(date.getDate()),
    sublabel: i === 0 || date.getDate() === 1 ? date.toLocaleString('en', { month: 'short' }) : undefined,
    values: { created: wave(0), merged: wave(0.9) },
  };
});

const WAIT_SERIES: ChartSeries[] = [
  { key: 'agent', label: 'Agent sessions', tone: 'chart-1' },
  { key: 'people', label: 'People', tone: 'chart-2' },
];
const WAITS: LinePoint[] = Array.from({ length: 15 }, (_, i) => ({
  label: `Week ${i + 1}`,
  values: { agent: 3.2 - i * 0.06 + Math.sin(i) * 0.5, people: 1.7 - i * 0.02 + Math.cos(i * 1.3) * 0.35 },
}));

const hours = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

/**
 * The review month: the range, created against merged per day with their
 * headline figures, three tiles, the median wait for agent sessions and
 * for people, the lane mix and why pull requests waited.
 */
export function PullRequestAnalyticsDemo() {
  const [range, setRange] = React.useState('month');
  const [mode, setMode] = React.useState('both');
  const shown = mode === 'both' ? SERIES : SERIES.filter((s) => s.key === mode);
  return (
    <div className="flex w-full flex-col gap-6 rounded-xl bg-canvas px-8 pt-10 pb-10">
      <PageHeader>
        <PageHeaderRow
          size="display"
          title="Your review month"
          actions={
            <SegmentedControl size="md" value={range} onValueChange={setRange} aria-label="Range">
              <SegmentedControlItem value="week">Week</SegmentedControlItem>
              <SegmentedControlItem value="month">Month</SegmentedControlItem>
              <SegmentedControlItem value="quarter">Quarter</SegmentedControlItem>
              <SegmentedControlItem value="custom">Custom</SegmentedControlItem>
            </SegmentedControl>
          }
        />
        <PageHeaderMeta indent={false}>
          <span>
            <span className="figures text-fg">Sep 5 – Oct 4</span> compared with the 30 days before · all repositories
          </span>
        </PageHeaderMeta>
      </PageHeader>
      <Panel>
        <div className="flex flex-wrap items-start gap-7">
          <ChartHero tone="chart-1" label="PRs created" value={248} delta={<StatDelta value="+12%" tone="good">from 221 last month</StatDelta>} />
          <ChartHero tone="chart-2" label="PRs merged" value={214} delta={<StatDelta value="+14%" tone="good">from 187 last month</StatDelta>} />
          <span className="flex-1" />
          <SegmentedControl size="md" value={mode} onValueChange={setMode} aria-label="Series">
            <SegmentedControlItem value="both">Created and merged</SegmentedControlItem>
            <SegmentedControlItem value="created">Created</SegmentedControlItem>
            <SegmentedControlItem value="merged">Merged</SegmentedControlItem>
          </SegmentedControl>
        </div>
        <BarChart series={shown} data={DAYS} aria-label="Pull requests created and merged per day" readout="Hover a day" />
        <ChartLegend series={shown} />
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Reviewed by you" value={152} detail={<StatDelta value="+9%" tone="good">from 139</StatDelta>} />
        <StatCard label="Median wait for review" value="2h 36m" detail={<StatDelta value="−16%" tone="good">from 3h 06m</StatDelta>} />
        <StatCard label="Median time to merge" value="7h 48m" detail={<StatDelta value="−17%" tone="good">from 9h 24m</StatDelta>} />
      </div>
      <Panel title="Median wait for your review" meta="vs last month">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatCard
            variant="inset"
            label={
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-pill bg-chart-1" />
                Agent sessions
                <BotIcon className="ml-auto size-3.5 text-fg-subtle" aria-hidden />
              </span>
            }
            value="3h 06m"
            detail={<StatDelta value="−21%" tone="good">from 3h 54m</StatDelta>}
          />
          <StatCard
            variant="inset"
            label={
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-pill bg-chart-2" />
                People
                <UserIcon className="ml-auto size-3.5 text-fg-subtle" aria-hidden />
              </span>
            }
            value="1h 30m"
            detail={<StatDelta value="−6%" tone="good">from 1h 36m</StatDelta>}
          />
        </div>
        <LineChart series={WAIT_SERIES} points={WAITS} ticks={[0, 1, 2, 3, 4]} format={(h) => (Number.isInteger(h) ? `${h}h` : hours(h))} from="Jul 1" to="Oct 4" aria-label="Median wait for review, agent sessions against people, per week" />
        <ChartLegend series={WAIT_SERIES} />
      </Panel>
      <PanelGrid>
        <Panel title="Lane mix" meta="vs last month">
          <RingChart
            label="Merged"
            value={214}
            segments={[
              { key: 'quick', label: 'Quick', value: 118, tone: 'chart-1' },
              { key: 'medium', label: 'Medium', value: 71, tone: 'chart-2' },
              { key: 'deep', label: 'Deep', value: 25, tone: 'chart-3' },
            ]}
          />
          <div className="flex flex-col">
            <ChartRow tone="chart-1" label="Quick" value={118} share="55%" delta={<StatDelta value="+4" tone="flat" />} />
            <ChartRow tone="chart-2" label="Medium" value={71} share="33%" delta={<StatDelta value="−2" tone="flat" />} />
            <ChartRow tone="chart-3" label="Deep" value={25} share="12%" delta={<StatDelta value="+1" tone="flat" />} />
          </div>
        </Panel>
        <Panel title="Why PRs waited on GitHub" meta={<span className="figures">31 this month · 44 last</span>}>
          <BarList
            rows={[
              { key: 'owner', label: 'Needs a code owner', value: 12, previous: 15, share: 39, detail: 'Median hold 5h 10m' },
              { key: 'checks', label: 'Required checks pending', value: 9, previous: 16, share: 29, detail: 'Median hold 1h 42m' },
              { key: 'conflicts', label: 'Conflicts with main', value: 6, previous: 8, share: 19, detail: 'Median hold 3h 05m' },
              { key: 'draft', label: 'Still a draft', value: 4, previous: 5, share: 13, detail: 'Median hold 22h' },
            ]}
          />
        </Panel>
      </PanelGrid>
    </div>
  );
}
