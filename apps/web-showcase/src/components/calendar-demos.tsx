'use client';

import { AgendaCalendar, type AgendaEntryData, agendaSlot } from '@oppenheimer/design-system-web/agenda-calendar';
import { Button } from '@oppenheimer/design-system-web/button';
import { CalendarLayerItem } from '@oppenheimer/design-system-web/calendar-source';
import { DatePicker } from '@oppenheimer/design-system-web/date-picker';
import { DragProvider } from '@oppenheimer/design-system-web/drag';
import { CalendarIcon, CircleCheckIcon, PlusIcon, UserIcon, ZapIcon } from '@oppenheimer/design-system-web/icons';
import {
  CalendarEntry,
  type CalendarEntryData,
  MonthCalendar,
} from '@oppenheimer/design-system-web/month-calendar';
import {
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web/page-header';
import { SortableGroup, useSortableGroups } from '@oppenheimer/design-system-web/drag';
import { SortableTodoRow, TodoRow, TodoRowAdd, TodoRowSkeleton } from '@oppenheimer/design-system-web/todo-row';
import * as React from 'react';

import { TODAY } from './plan-fixtures';

/* ------------------------------------------------------------------ the calendar */

const ENTRIES: CalendarEntryData[] = [
  { id: 'e1', date: '2026-10-01', kind: 'automation', title: 'Monthly cost report', time: '08:00', draggable: false },
  { id: 'e2', date: '2026-10-01', kind: 'event', title: 'Atlas standup', time: '09:30' },
  { id: 'e3', date: '2026-10-02', kind: 'event', title: 'Quarterly planning', time: '10:00', busy: true },
  { id: 'e4', date: '2026-10-02', kind: 'automation', title: 'Release notes', time: '16:00', draggable: false },
  { id: 'e5', date: '2026-10-04', kind: 'task', title: 'Rotate flama-ai API keys' },
  { id: 'e6', date: '2026-10-05', kind: 'event', title: 'Design review', time: '15:00', busy: true },
  { id: 'e7', date: '2026-10-06', kind: 'task', title: 'Biometric unlock on Android' },
  { id: 'e8', date: '2026-10-06', kind: 'event', title: '1:1 with Adri', time: '12:00', busy: true },
  { id: 'e9', date: '2026-10-07', kind: 'task', title: 'Address review comments on PR #121' },
  { id: 'e10', date: '2026-10-07', kind: 'event', title: 'Gym', time: '07:30' },
  { id: 'e11', date: '2026-10-07', kind: 'event', title: 'Inbox and planning', time: '08:45', busy: true },
  { id: 'e12', date: '2026-10-07', kind: 'event', title: 'Hiring sync', time: '10:00', busy: true },
  { id: 'e13', date: '2026-10-07', kind: 'event', title: 'Atlas pricing workshop', time: '10:45', busy: true },
  { id: 'e14', date: '2026-10-07', kind: 'event', title: 'Lunch with Pau', time: '12:30' },
  { id: 'e15', date: '2026-10-10', kind: 'task', title: 'Draft the beta waitlist email' },
  { id: 'e16', date: '2026-10-13', kind: 'event', title: 'Dentist', time: '08:30', busy: true },
  { id: 'e17', date: '2026-10-16', kind: 'event', title: 'XRP Mobile review', time: '16:00', busy: true },
  { id: 'e18', date: '2026-10-23', kind: 'event', title: 'Flight to Lisbon', allDay: true, busy: true },
  { id: 'e19', date: '2026-09-29', kind: 'event', title: 'Atlas standup', time: '09:30' },
  { id: 'e20', date: '2026-11-01', kind: 'automation', title: 'Monthly cost report', time: '08:00', draggable: false },
];

const LAYERS = [
  { id: 'google', label: 'Google Calendar', icon: <CalendarIcon /> },
  { id: 'personal', label: 'Personal', icon: <UserIcon /> },
  { id: 'tasks', label: 'Task due dates', icon: <CircleCheckIcon /> },
  { id: 'autos', label: 'Automations', icon: <ZapIcon /> },
] as const;

/**
 * Plan's month: drag an event or a task to another day (automation runs
 * keep their schedule), open a busy day's "N more", and switch sources off
 * in the sidebar's list. The page owns the `DragProvider`; a day's target
 * id is its date.
 */
export function MonthCalendarDemo() {
  const [entries, setEntries] = React.useState(ENTRIES);
  const [layers, setLayers] = React.useState<Record<string, boolean>>({ google: true, personal: true, tasks: true, autos: true });
  const shown = entries.filter((e) =>
    e.kind === 'task' ? layers.tasks : e.kind === 'automation' ? layers.autos : e.busy ? layers.google : layers.personal,
  );
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (
    <div className="flex w-full flex-col gap-6 rounded-xl bg-canvas p-6 xl:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 xl:w-60">
        <span className="eyebrow px-2.5 pb-1">Calendars</span>
        {LAYERS.map((layer) => (
          <CalendarLayerItem
            key={layer.id}
            icon={layer.icon}
            checked={layers[layer.id] ?? false}
            onCheckedChange={(checked) => setLayers((current) => ({ ...current, [layer.id]: checked }))}
          >
            {layer.label}
          </CalendarLayerItem>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <PageHeader>
          <PageHeaderRow
            size="display"
            title="October 2026"
            actions={
              <>
                <Button variant="secondary" size="sm">
                  Today
                </Button>
                <Button>
                  <PlusIcon />
                  New event
                </Button>
              </>
            }
          />
          <PageHeaderMeta indent={false}>
            <PageHeaderStat value={32}>meetings</PageHeaderStat>
            <PageHeaderSep />
            <PageHeaderStat value={5}>tasks due</PageHeaderStat>
            <PageHeaderSep />
            <PageHeaderStat value={10}>automation runs</PageHeaderStat>
          </PageHeaderMeta>
        </PageHeader>
        <DragProvider
          overlay={(active) => {
            const entry = byId.get(active.id);
            return entry ? <CalendarEntry entry={entry} lifted tabIndex={-1} /> : null;
          }}
          onDragEnd={({ active, over }) => {
            if (over) setEntries((current) => current.map((e) => (e.id === active.id ? { ...e, date: over.id } : e)));
          }}
        >
          <MonthCalendar year={2026} month={9} today={TODAY} entries={shown} />
        </DragProvider>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ day and week */

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

const AGENDA: AgendaEntryData[] = [
  { id: 'a1', date: '2026-10-07', kind: 'event', title: 'Inbox and planning', time: '08:45', end: '09:30', busy: true },
  { id: 'a2', date: '2026-10-07', kind: 'automation', title: 'Dependency audit', time: '09:00', end: '09:30', draggable: false },
  { id: 'a3', date: '2026-10-07', kind: 'task', title: 'Address review comments on PR #121', time: '10:00', end: '11:00' },
  { id: 'a4', date: '2026-10-07', kind: 'event', title: 'Hiring sync', time: '10:00', end: '10:45', busy: true },
  { id: 'a5', date: '2026-10-07', kind: 'event', title: 'Lunch with Pau', time: '12:30', end: '13:30' },
  { id: 'a6', date: '2026-10-07', kind: 'task', title: 'Rotate flama-ai API keys', time: '15:00', end: '16:00', done: true },
  { id: 'a7', date: '2026-10-07', kind: 'task', title: 'Draft the beta waitlist email' },
  { id: 'a8', date: '2026-10-05', kind: 'event', title: 'Design review', time: '15:00', end: '16:00', busy: true },
  { id: 'a9', date: '2026-10-06', kind: 'event', title: '1:1 with Adri', time: '12:00', end: '12:30', busy: true },
  { id: 'a10', date: '2026-10-09', kind: 'automation', title: 'Release notes draft', time: '16:00', end: '16:30', draggable: false },
  { id: 'a11', date: '2026-10-08', kind: 'event', title: 'Flight to Lisbon', allDay: true, busy: true },
];

/**
 * Plan's Day and Week: drag an event or a task onto another hour or into All
 * day; the drop's id is `<date>T<HH:MM>` or the bare date, read back with
 * `agendaSlot`. A day's head opens that day.
 */
export function AgendaCalendarDemo() {
  const [entries, setEntries] = React.useState(AGENDA);
  const [day, setDay] = React.useState<string | null>(null);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const move = (id: string, target: string) => {
    const { date, time } = agendaSlot(target);
    setEntries((current) =>
      current.map((e) => {
        if (e.id !== id) return e;
        if (!time) return { ...e, date, time: undefined, end: undefined, allDay: e.kind === 'event' };
        const [h, m] = time.split(':').map(Number);
        const end = `${String((h ?? 0) + 1).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
        return { ...e, date, time, end, allDay: false };
      }),
    );
  };
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl bg-canvas p-6">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDay(null)}>
          Week
        </Button>
        <span className="text-sm text-fg-muted">{day ? `Day · ${day}` : 'Week of Oct 5'}</span>
      </div>
      <DragProvider
        overlay={(active) => {
          const entry = byId.get(active.id);
          return entry ? <CalendarEntry entry={entry} lifted tabIndex={-1} /> : null;
        }}
        onDragEnd={({ active, over }) => {
          if (over) move(active.id, over.id);
        }}
      >
        <AgendaCalendar days={day ? [day] : WEEK} entries={entries} today={TODAY} now="11:20" onOpenDay={setDay} />
      </DragProvider>
    </div>
  );
}

/* ------------------------------------------------------------------ to do */

const TODOS = [
  { id: 'd1', title: 'Address review comments on PR #121', detail: 'Wallet 2.0 · in progress', time: '10:00', tag: 'XRP Mobile', done: false },
  { id: 'd2', title: 'Rotate flama-ai API keys', detail: 'overdue since Oct 3', tag: 'Client sites', done: false },
  { id: 'd3', title: 'Draft the beta waitlist email', detail: 'Atlas public beta · due today', tag: 'Atlas', done: true },
];

/** Plan's To do: tick a task (the title opens it), drag one by its grip, add one under the list on Enter. */
export function TodoListDemo() {
  const [rows, setRows] = React.useState(TODOS);
  const [draft, setDraft] = React.useState('');
  const byId = new Map(rows.map((row) => [row.id, row]));
  const handlers = useSortableGroups({ todo: rows.map((row) => row.id) }, (next) =>
    setRows((current) => (next.todo ?? []).flatMap((id) => current.filter((row) => row.id === id))),
  );
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2 rounded-xl bg-canvas p-6">
      <DragProvider
        {...handlers}
        overlay={(active) => {
          const row = byId.get(active.id);
          return row ? <TodoRow {...row} toggleLabel="Mark done" /> : null;
        }}
      >
        <SortableGroup id="todo" items={rows.map((row) => row.id)} accepts={['todo-row']} className="flex flex-col gap-2">
          {rows.map((row) => (
            <SortableTodoRow
              key={row.id}
              id={row.id}
              title={row.title}
              detail={row.detail}
              time={row.time}
              tag={row.tag}
              done={row.done}
              toggleLabel={row.done ? 'Mark not done' : 'Mark done'}
              gripLabel={`Reorder ${row.title}`}
              onToggle={() => setRows((current) => current.map((r) => (r.id === row.id ? { ...r, done: !r.done } : r)))}
            />
          ))}
        </SortableGroup>
      </DragProvider>
      <TodoRowAdd
        aria-label="Add a task for this day"
        placeholder="Add a task"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !draft.trim()) return;
          setRows((current) => [...current, { id: `d${Date.now()}`, title: draft.trim(), detail: 'due today', tag: 'Atlas', done: false, time: undefined }]);
          setDraft('');
        }}
      />
      <TodoRowSkeleton />
    </div>
  );
}

/* ------------------------------------------------------------------ the date picker */

export function DatePickerDemo() {
  const [due, setDue] = React.useState<string | null>('2026-10-10');
  const [empty, setEmpty] = React.useState<string | null>(null);
  const quick = [
    { label: 'Today', value: TODAY },
    { label: 'Tomorrow', value: '2026-10-06' },
    { label: 'Next Monday', value: '2026-10-12' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DatePicker value={due} onValueChange={setDue} today={TODAY} quick={quick} />
      <DatePicker value={empty} onValueChange={setEmpty} today={TODAY} quick={quick} placeholder="Add a date" />
    </div>
  );
}
