'use client';

import * as React from 'react';

import { BrandGlyph } from '@oppenheimer/design-system-web/brand-glyph';
import {
  CalendarAccountAdd,
  CalendarAccountList,
  CalendarAccountRow,
} from '@oppenheimer/design-system-web/calendar-source';
import { AreaChart, ChartLegend, type ChartSeries } from '@oppenheimer/design-system-web/charts';
import { type DateRange, DateRangePicker } from '@oppenheimer/design-system-web/date-range-picker';
import { FacetSelect } from '@oppenheimer/design-system-web/facet-select';
import { FolderIcon } from '@oppenheimer/design-system-web/icons';
import {
  MilestoneGlyph,
  MilestoneTimeline,
  type TimelineRow,
} from '@oppenheimer/design-system-web/milestone-timeline';

import { TODAY } from './plan-fixtures';

/* ── FacetSelect ─────────────────────────────────────────────────────────── */

export function FacetSelectDemo() {
  const [project, setProject] = React.useState('all');
  const [milestone, setMilestone] = React.useState('beta');
  const [lane, setLane] = React.useState('all');
  const [checks, setChecks] = React.useState('failing');
  const [wait, setWait] = React.useState('any');
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <FacetSelect
          variant="pill"
          label="Project"
          icon={<FolderIcon />}
          value={project}
          onValueChange={setProject}
          options={[
            { value: 'all', label: 'All projects', count: 24 },
            { value: 'web', label: 'acme-web', count: 12 },
            { value: 'billing', label: 'billing', count: 7 },
            { value: 'none', label: 'No project', count: 5 },
          ]}
        />
        <FacetSelect
          variant="pill"
          label="Milestone"
          icon={<MilestoneGlyph />}
          value={milestone}
          onValueChange={setMilestone}
          options={[
            { value: 'any', label: 'Any milestone', count: 24 },
            { value: 'beta', label: 'Public beta', count: 9 },
            { value: 'billing', label: 'Usage billing', count: 6 },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FacetSelect
          label="Difficulty"
          value={lane}
          onValueChange={setLane}
          options={[
            { value: 'all', label: 'All', count: 11 },
            { value: 'deep', label: 'Deep', count: 3 },
            { value: 'medium', label: 'Medium', count: 4 },
            { value: 'quick', label: 'Quick', count: 4 },
          ]}
        />
        <FacetSelect
          label="Checks"
          value={checks}
          onValueChange={setChecks}
          options={[
            { value: 'any', label: 'Any', count: 11 },
            { value: 'passing', label: 'Passing', count: 7 },
            { value: 'failing', label: 'Failing', count: 2 },
            { value: 'running', label: 'Running', count: 2 },
          ]}
        />
        <FacetSelect
          label="Waiting"
          value={wait}
          onValueChange={setWait}
          options={[
            { value: 'any', label: 'Any time', count: 11 },
            { value: 'lt1', label: 'Under 1h', count: 3 },
            { value: 'day', label: '1h – 1 day', count: 5 },
            { value: 'gt1', label: 'Over 1 day', count: 3 },
          ]}
        />
      </div>
    </div>
  );
}

/* ── MilestoneTimeline ───────────────────────────────────────────────────── */

const ROWS: TimelineRow[] = [
  {
    id: 'web',
    name: 'acme-web',
    progress: 62,
    milestones: [
      { id: 'auth', name: 'Auth rewrite', due: '2026-09-18', done: 8, total: 8 },
      { id: 'beta', name: 'Public beta', due: '2026-10-23', done: 5, total: 9 },
      { id: 'ga', name: 'General availability', due: '2026-11-27', done: 0, total: 6 },
    ],
  },
  {
    id: 'billing',
    name: 'billing',
    progress: 31,
    milestones: [
      { id: 'meter', name: 'Usage metering', due: '2026-10-09', done: 4, total: 5 },
      { id: 'invoices', name: 'Invoices', due: '2026-11-06', done: 1, total: 6 },
    ],
  },
];

export function MilestoneTimelineDemo() {
  return <MilestoneTimeline rows={ROWS} today={TODAY} onOpenMilestone={() => {}} onOpenRow={() => {}} />;
}

/* ── DateRangePicker ─────────────────────────────────────────────────────── */

const PRESETS = [
  { id: '7d', label: 'Last 7 days', range: { from: '2026-09-29', to: TODAY } },
  { id: '30d', label: 'Last 30 days', range: { from: '2026-09-06', to: TODAY } },
  { id: '90d', label: 'Last 90 days', range: { from: '2026-07-08', to: TODAY } },
  { id: 'month', label: 'This month', range: { from: '2026-10-01', to: TODAY } },
  { id: 'last-month', label: 'Last month', range: { from: '2026-09-01', to: '2026-09-30' } },
];

export function DateRangePickerDemo() {
  const [range, setRange] = React.useState<DateRange>(PRESETS[1]?.range as DateRange);
  const [compare, setCompare] = React.useState(true);
  return (
    <div className="flex w-full justify-end">
      <DateRangePicker
        value={range}
        onValueChange={setRange}
        presets={PRESETS}
        today={TODAY}
        compare={compare}
        onCompareChange={setCompare}
      />
    </div>
  );
}

/* ── AreaChart ───────────────────────────────────────────────────────────── */

const TOKEN_SERIES: ChartSeries[] = [
  { key: 'sonnet', label: 'Claude Sonnet 4.5', tone: 'chart-1' },
  { key: 'codex', label: 'Codex', tone: 'chart-2' },
];

const WEEKS = [
  ['Aug 24', 1.2, 0.4],
  ['Aug 31', 1.8, 0.6],
  ['Sep 7', 1.5, 0.9],
  ['Sep 14', 2.6, 1.1],
  ['Sep 21', 2.2, 0.8],
  ['Sep 28', 3.4, 1.4],
  ['Oct 5', 3.1, 1.9],
] as const;

export function AreaChartDemo() {
  return (
    <div className="grid w-full gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">Tokens per week</span>
          <ChartLegend series={TOKEN_SERIES} />
        </span>
        <AreaChart
          series={TOKEN_SERIES}
          points={WEEKS.map(([label, a, b]) => ({ label, values: { sonnet: a, codex: b } }))}
          ticks={[0, 1, 2, 3, 4]}
          format={(v) => `${v}M`}
          aria-label="Tokens per week"
        />
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-[15px] font-medium">Cost per week</span>
        <AreaChart
          series={[{ key: 'cost', label: 'Cost', tone: 'chart-3' }]}
          points={WEEKS.map(([label, a, b]) => ({ label, values: { cost: Math.round((a * 9 + b * 6) * 10) / 10 } }))}
          ticks={[0, 10, 20, 30, 40]}
          format={(v) => `$${v}`}
          aria-label="Cost per week"
        />
      </div>
    </div>
  );
}

/* ── CalendarAccountList ─────────────────────────────────────────────────── */

export function CalendarAccountsDemo() {
  const [accounts, setAccounts] = React.useState(['jordi@acme.dev', 'jordi.parra@gmail.com']);
  return (
    <div className="w-64">
      <CalendarAccountList>
        {accounts.map((account, i) => (
          <CalendarAccountRow
            key={account}
            mark={<BrandGlyph name="google" />}
            account={account}
            status={i === 1 ? 'Sync failed · 3h ago' : 'Synced 2 min ago'}
            failed={i === 1}
            onReconnect={() => {}}
            onDisconnect={() => setAccounts((a) => a.filter((x) => x !== account))}
          />
        ))}
        <CalendarAccountAdd />
      </CalendarAccountList>
    </div>
  );
}
