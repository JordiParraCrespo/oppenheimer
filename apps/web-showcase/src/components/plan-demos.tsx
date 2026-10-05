'use client';

import { BrandGlyph } from '@oppenheimer/design-system-web/brand-glyph';
import { Button } from '@oppenheimer/design-system-web/button';
import {
  CalendarLayerItem,
  CalendarSourceCard,
} from '@oppenheimer/design-system-web/calendar-source';
import { Callout } from '@oppenheimer/design-system-web/callout';
import { Chip } from '@oppenheimer/design-system-web/chip';
import { ChipSelect, type ChipSelectOption } from '@oppenheimer/design-system-web/chip-select';
import { DatePicker } from '@oppenheimer/design-system-web/date-picker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@oppenheimer/design-system-web/dialog';
import {
  type DragItem,
  DragProvider,
  type SortableGroups,
  SortableGroup,
  SortableItem,
  useDraggable,
  useDroppable,
  useSortableGroups,
} from '@oppenheimer/design-system-web/drag';
import { GoalCard, GoalEmpty, GoalGrid } from '@oppenheimer/design-system-web/goal-card';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  CalendarIcon,
  CircleCheckIcon,
  EllipsisIcon,
  GripVerticalIcon,
  PlayIcon,
  PlusIcon,
  UserIcon,
  ZapIcon,
} from '@oppenheimer/design-system-web/icons';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import {
  type CalendarEntryData,
  MonthCalendar,
} from '@oppenheimer/design-system-web/month-calendar';
import {
  PageHeaderDisplay,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web/page-header';
import {
  TaskBoard,
  TaskCard,
  TaskColumn,
  TaskColumnAdd,
  TaskComposer,
  TaskSessionChip,
  type TaskStatus,
  TaskStatusDot,
} from '@oppenheimer/design-system-web/task-board';
import { SessionPaneBack, SessionPaneHeader } from '@oppenheimer/design-system-web/session-pane-header';
import {
  Terminal,
  TerminalLine,
  TerminalPrompt,
  TerminalScrollback,
} from '@oppenheimer/design-system-web/terminal';
import * as React from 'react';

/**
 * Plan in the showcase. The page is prerendered, so "today" is a fixed day
 * rather than a clock: the demos read the same on the server and in the
 * browser.
 */
const TODAY = '2026-10-05';

/* ------------------------------------------------------------------ the drag layer on its own */

const FRUIT = ['Draft the copy', 'Review the PR', 'Book the venue', 'Ship the beta'];

/**
 * The primitives with no product in them: one sortable list, and two bins
 * that take what is dropped on them. The same parts build the board and the
 * calendar below.
 */
export function DragPrimitivesDemo() {
  const [groups, setGroups] = React.useState<SortableGroups>({ list: FRUIT, done: [] });
  const sortable = useSortableGroups(groups, setGroups);
  const [binned, setBinned] = React.useState<string | null>(null);

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <DragProvider
        {...sortable}
        overlay={(active) => <Row label={active.id} lifted />}
        labels={{ pickedUp: (name) => `Picked up ${name}.` }}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['list', 'done'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <span className="eyebrow px-1">{group === 'list' ? 'Sortable list' : 'Another group'}</span>
              <SortableGroup id={group} items={groups[group] ?? []}>
                <div className="flex min-h-40 flex-col gap-1.5 rounded-lg bg-hover-surface p-1.5 transition-colors duration-fast in-data-over:bg-selected-surface">
                  {(groups[group] ?? []).map((id) => (
                    <SortableItem key={id} id={id} data={{ label: id }}>
                      <Row label={id} />
                    </SortableItem>
                  ))}
                </div>
              </SortableGroup>
            </div>
          ))}
        </div>
      </DragProvider>
      <DragProvider
        overlay={(active: DragItem) => <Row label={String(active.data.label ?? active.id)} lifted />}
        onDragEnd={({ active, over }) => setBinned(over ? `${active.data.label} → ${over.data.label}` : null)}
      >
        <div className="flex flex-col gap-3">
          <span className="eyebrow px-1">Draggable · droppable</span>
          <div className="flex gap-2">
            <Token id="a" label="An event" type="event" />
            <Token id="b" label="A task" type="task" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Bin id="any" label="Takes anything" />
            <Bin id="tasks" label="Takes tasks only" accepts={['task']} />
          </div>
          <span className="figures min-h-5 text-xs text-fg-subtle">{binned ?? 'Drop a token on a bin.'}</span>
        </div>
      </DragProvider>
    </div>
  );
}

function Row({ label, lifted }: { label: string; lifted?: boolean }) {
  return (
    <div
      className={
        lifted
          ? 'flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-fg'
          : 'flex h-10 cursor-grab items-center gap-2 rounded-md border border-border-subtle bg-card px-3 text-sm text-fg hover:border-border'
      }
    >
      <GripVerticalIcon className="size-3.5 text-fg-subtle" aria-hidden />
      {label}
    </div>
  );
}

function Token({ id, label, type }: { id: string; label: string; type: string }) {
  const drag = useDraggable({ id, data: { type, label } });
  return (
    <button
      ref={drag.ref}
      type="button"
      {...drag.handleProps}
      className="h-8 touch-none rounded-pill border border-border bg-card px-3 text-sm text-fg data-[dragging=true]:opacity-40"
      data-dragging={drag.isDragging}
    >
      {label}
    </button>
  );
}

function Bin({ id, label, accepts }: { id: string; label: string; accepts?: string[] }) {
  const drop = useDroppable({ id, data: { label }, accepts });
  return (
    <div
      ref={drop.ref}
      data-over={drop.isOver || undefined}
      data-can-drop={drop.canDrop || undefined}
      className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-fg-muted transition-colors duration-fast data-can-drop:border-ring data-over:bg-selected-surface data-over:text-fg"
    >
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ the board */

interface Task {
  id: string;
  title: string;
  notes?: string;
  project?: string;
  goal?: string;
  due?: string;
  dueTone?: 'soon' | 'overdue';
  session?: { state: 'running' | 'needs-input' | 'completed'; word: string; name: string; more?: number };
}

const TASKS: Record<string, Task> = {
  t1: { id: 't1', title: 'Write a migration guide for legacy wallet users', project: 'XRP Mobile', goal: 'Ship XRP Mobile 2.0 to TestFlight' },
  t2: { id: 't2', title: 'Evaluate Codex for nightly refactors', notes: 'Compare against Claude Code on the atlas test suite before switching anything over.' },
  t3: { id: 't3', title: 'Address review comments on PR #121', project: 'XRP Mobile', goal: 'Ship XRP Mobile 2.0 to TestFlight', due: 'Oct 7', session: { state: 'running', word: 'Running', name: 'PR #121 porting to peersyst' } },
  t4: { id: 't4', title: 'Draft the beta waitlist email', project: 'Atlas', goal: 'Atlas public beta', due: 'Oct 10' },
  t5: { id: 't5', title: 'Rotate flama-ai API keys', project: 'Client sites', due: 'Yesterday', dueTone: 'overdue' },
  t6: { id: 't6', title: 'Biometric unlock on Android', notes: 'Blocked on a keystore edge case on Pixel 6.', project: 'XRP Mobile', goal: 'Ship XRP Mobile 2.0 to TestFlight', due: 'Tomorrow', dueTone: 'soon', session: { state: 'needs-input', word: 'Needs input', name: 'biometric-unlock', more: 1 } },
  t7: { id: 't7', title: 'Atlas onboarding flow', project: 'Atlas', goal: 'Atlas public beta', due: 'Oct 11', session: { state: 'running', word: 'Running', name: 'atlas-onboarding-flow' } },
  t8: { id: 't8', title: 'Upgrade React Native to 0.76', project: 'XRP Mobile', goal: 'Ship XRP Mobile 2.0 to TestFlight' },
  t9: { id: 't9', title: 'flama-ai landing copy', project: 'Client sites', session: { state: 'completed', word: 'Completed', name: 'First version of the landing' } },
};

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'later', label: 'Later' },
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

const GOALS = [
  { id: 'Ship XRP Mobile 2.0 to TestFlight', meta: ['XRP Mobile', 'Nov 1'] },
  { id: 'Atlas public beta', meta: ['Atlas', 'Nov 16'] },
];

/**
 * Plan's Tasks page as the design system draws it: the display header, the
 * goals (picking one narrows the board), and the board itself — drag a card
 * within or across columns, check one off, add one at a column's foot.
 */
export function TaskBoardDemo() {
  const [tasks, setTasks] = React.useState(TASKS);
  const [groups, setGroups] = React.useState<SortableGroups>({
    later: ['t1', 't2'],
    todo: ['t3', 't4', 't5'],
    doing: ['t6', 't7'],
    done: ['t8', 't9'],
  });
  const [goal, setGoal] = React.useState<string | null>(null);
  const [composing, setComposing] = React.useState<TaskStatus | null>(null);
  const [draft, setDraft] = React.useState('');

  const visible = (ids: readonly string[]) => (goal ? ids.filter((id) => tasks[id]?.goal === goal) : ids);
  const shown: SortableGroups = Object.fromEntries(Object.entries(groups).map(([k, ids]) => [k, visible(ids)]));
  // A narrowed board moves the cards it shows; the hidden ones keep their place at the end.
  const sortable = useSortableGroups(shown, (next) =>
    setGroups((current) =>
      Object.fromEntries(
        Object.entries(current).map(([k, ids]) => {
          const moved = next[k] ?? [];
          const hidden = ids.filter((id) => !Object.values(next).some((list) => list.includes(id)));
          return [k, [...moved, ...hidden]];
        }),
      ),
    ),
  );

  const doneIds = groups.done ?? [];
  const open = Object.values(groups).flat().length - doneIds.length;
  const toggle = (id: string) =>
    setGroups((current) => {
      const from = Object.keys(current).find((k) => current[k]?.includes(id)) ?? 'todo';
      const to = from === 'done' ? 'todo' : 'done';
      return {
        ...current,
        [from]: (current[from] ?? []).filter((x) => x !== id),
        [to]: [id, ...(current[to] ?? [])],
      };
    });

  return (
    <div className="flex w-full flex-col gap-9 rounded-xl bg-canvas px-8 pt-10 pb-12">
      <PageHeaderDisplay
        title="Tasks"
        facts={
          <>
            <PageHeaderStat value={open}>open</PageHeaderStat>
            <PageHeaderSep />
            <PageHeaderStat value={(groups.doing ?? []).length}>in progress</PageHeaderStat>
            <PageHeaderSep />
            <PageHeaderStat value={doneIds.length}>done</PageHeaderStat>
            <PageHeaderSep />
            <PageHeaderStat value={1} tone="danger">
              overdue
            </PageHeaderStat>
          </>
        }
        actions={
          <Button>
            <PlusIcon />
            New task
          </Button>
        }
      />
      <section className="flex flex-col gap-3">
        <div className="flex items-center px-1">
          <span className="eyebrow flex-1">Goals</span>
          <Button variant="ghost" size="sm">
            <PlusIcon />
            New goal
          </Button>
        </div>
        <GoalGrid>
          {GOALS.map((g) => {
            const linked = Object.values(tasks).filter((t) => t.goal === g.id);
            const done = linked.filter((t) => doneIds.includes(t.id)).length;
            return (
              <GoalCard
                key={g.id}
                name={g.id}
                meta={
                  <>
                    {g.meta[0]} <span className="text-fg-subtle">·</span> <span className="figures">{g.meta[1]}</span>
                  </>
                }
                done={done}
                total={linked.length}
                countLabel={`${done} / ${linked.length} tasks`}
                selected={goal === g.id}
                onSelect={() => setGoal((current) => (current === g.id ? null : g.id))}
                action={
                  <IconButton size="sm" aria-label="Edit goal">
                    <EllipsisIcon />
                  </IconButton>
                }
              />
            );
          })}
          <GoalEmpty title="No goals for this project">Goals group tasks and track how many are done.</GoalEmpty>
        </GoalGrid>
      </section>
      <DragProvider
        {...sortable}
        overlay={(active) => {
          const task = tasks[active.id];
          return task ? <Card task={task} done={doneIds.includes(task.id)} lifted /> : null;
        }}
      >
        <TaskBoard>
          {COLUMNS.map((column) => (
            <TaskColumn
              key={column.id}
              id={column.id}
              status={column.id}
              label={column.label}
              count={(shown[column.id] ?? []).length}
              items={shown[column.id] ?? []}
              onAdd={() => setComposing(column.id)}
              addLabel={`Add task to ${column.label}`}
              foot={
                composing === column.id ? (
                  <TaskComposer
                    value={draft}
                    onValueChange={setDraft}
                    label="Task title"
                    placeholder="What needs doing?"
                    hint={goal ? `In ${goal}` : 'In all projects'}
                    onCancel={() => {
                      setComposing(null);
                      setDraft('');
                    }}
                    onSubmit={(title) => {
                      const id = `n${Date.now()}`;
                      setTasks((current) => ({ ...current, [id]: { id, title, goal: goal ?? undefined } }));
                      setGroups((current) => ({ ...current, [column.id]: [...(current[column.id] ?? []), id] }));
                      setDraft('');
                    }}
                  />
                ) : (
                  <TaskColumnAdd onClick={() => setComposing(column.id)}>Add task</TaskColumnAdd>
                )
              }
            >
              {(shown[column.id] ?? []).map((id) => {
                const task = tasks[id];
                if (!task) return null;
                return (
                  <SortableItem key={id} id={id} data={{ type: 'task', label: task.title }}>
                    <Card task={task} done={column.id === 'done'} onToggle={() => toggle(id)} hideGoal={goal !== null} />
                  </SortableItem>
                );
              })}
            </TaskColumn>
          ))}
        </TaskBoard>
      </DragProvider>
    </div>
  );
}

function Card({
  task,
  done,
  onToggle,
  hideGoal,
  lifted,
}: { task: Task; done: boolean; onToggle?: () => void; hideGoal?: boolean; lifted?: boolean }) {
  return (
    <TaskCard
      title={task.title}
      notes={task.notes}
      done={done}
      onToggleDone={onToggle}
      checkLabel={done ? 'Mark as not done' : 'Mark as done'}
      project={task.project}
      goal={hideGoal ? undefined : task.goal}
      due={task.due}
      dueTone={task.dueTone}
      onStart={lifted ? undefined : () => {}}
      session={
        task.session ? (
          <TaskSessionChip
            state={task.session.state}
            word={task.session.word}
            name={task.session.name}
            more={task.session.more}
            title="Open in console"
          />
        ) : undefined
      }
    />
  );
}

/** The four statuses' dots, as the column heads and the task dialog draw them. */
export function TaskStatusDots() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-fg">
      {COLUMNS.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-2">
          <TaskStatusDot status={c.id} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

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
 * in the sidebar's list.
 */
export function MonthCalendarDemo() {
  const [entries, setEntries] = React.useState(ENTRIES);
  const [layers, setLayers] = React.useState<Record<string, boolean>>({ google: true, personal: true, tasks: true, autos: true });
  const shown = entries.filter((e) =>
    e.kind === 'task' ? layers.tasks : e.kind === 'automation' ? layers.autos : e.busy ? layers.google : layers.personal,
  );
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
        <CalendarSourceCard
          className="mx-2.5 mt-4"
          mark={<BrandGlyph name="google" />}
          name="Google Calendar"
          account="jordiparra99@gmail.com"
          status="Synced 2 min ago"
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <PageHeaderDisplay
          title="October 2026"
          facts={
            <>
              <PageHeaderStat value={32}>meetings</PageHeaderStat>
              <PageHeaderSep />
              <PageHeaderStat value={5}>tasks due</PageHeaderStat>
              <PageHeaderSep />
              <PageHeaderStat value={10}>automation runs</PageHeaderStat>
            </>
          }
          actions={
            <>
              <Button variant="secondary" size="sm" className="mr-1.5">
                Today
              </Button>
              <Button>
                <PlusIcon />
                New event
              </Button>
            </>
          }
        />
        <MonthCalendar
          year={2026}
          month={9}
          today={TODAY}
          entries={shown}
          onMove={(id, date) => setEntries((current) => current.map((e) => (e.id === id ? { ...e, date } : e)))}
        />
      </div>
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

/* ------------------------------------------------------------------ the dialogs */

const PROJECTS: ChipSelectOption[] = [
  { value: 'xrp-mobile', label: 'XRP Mobile' },
  { value: 'atlas', label: 'Atlas' },
  { value: 'client-sites', label: 'Client sites' },
];
const GOAL_OPTIONS: ChipSelectOption[] = [
  { value: 'none', label: 'No goal' },
  { value: 'atlas-beta', label: 'Atlas public beta' },
];
const HOST_OPTIONS: ChipSelectOption[] = [
  { value: 'mac-studio', label: 'jordis-mac-studio', description: 'local · 2 sessions running' },
  { value: 'optimus', label: 'optimus', description: '32 vCPU · eu-west · idle' },
  { value: 'fable', label: 'fable', description: 'Offline · last seen 2 days ago' },
];
const REPO_OPTIONS: ChipSelectOption[] = [
  { value: 'atlas', label: 'atlas', description: 'main', mono: true },
  { value: 'flama-ai', label: 'flama-ai', description: 'main', mono: true },
];

/**
 * The task dialog and Start session, composed from the system's parts: the
 * statuses and the agent's models are fixed, so they are chips; projects,
 * goals, hosts and repositories grow with the workspace, so they are
 * `ChipSelect`s that filter.
 */
export function PlanDialogsDemo() {
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [startOpen, setStartOpen] = React.useState(false);
  const [status, setStatus] = React.useState<TaskStatus>('todo');
  const [project, setProject] = React.useState('atlas');
  const [goal, setGoal] = React.useState('atlas-beta');
  const [due, setDue] = React.useState<string | null>('2026-10-10');
  const [host, setHost] = React.useState('fable');
  const [repo, setRepo] = React.useState('atlas');
  const [agent, setAgent] = React.useState('Claude Code');
  const [model, setModel] = React.useState('Sonnet 4.6');

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setTaskOpen(true)}>
        Edit task
      </Button>
      <Button variant="secondary" onClick={() => setStartOpen(true)}>
        <PlayIcon />
        Start session
      </Button>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent size="form">
          <DialogBody>
            <div className="flex flex-col gap-5">
            <DialogTitle>Edit task</DialogTitle>
            <div className="flex flex-col gap-2 border-b border-border-subtle pb-4">
              <input
                aria-label="Title"
                defaultValue="Draft the beta waitlist email"
                className="border-0 bg-transparent p-0 text-h3 font-semibold text-fg outline-none"
              />
              <textarea
                aria-label="Notes"
                rows={3}
                placeholder="Notes"
                className="resize-none border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            <dl className="grid grid-cols-4 items-center gap-x-4 gap-y-3 text-sm">
              <dt className="col-span-1 text-fg-muted">Status</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                {COLUMNS.map((c) => (
                  <Chip key={c.id} variant="solid" selected={status === c.id} onClick={() => setStatus(c.id)} icon={<TaskStatusDot status={c.id} />}>
                    {c.label}
                  </Chip>
                ))}
              </dd>
              <dt className="col-span-1 text-fg-muted">Project</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={project} onValueChange={setProject} options={PROJECTS} aria-label="Project" searchPlaceholder="Search projects…" emptyText="No project matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Goal</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={goal} onValueChange={setGoal} options={GOAL_OPTIONS} aria-label="Goal" searchPlaceholder="Search goals…" emptyText="No goal matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Sessions</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => setStartOpen(true)}>
                  <PlayIcon />
                  Start session
                </Button>
                <Button variant="ghost" size="sm">
                  Link existing
                </Button>
              </dd>
              <dt className="col-span-1 text-fg-muted">Due</dt>
              <dd className="col-span-3 m-0 flex items-center gap-3">
                <DatePicker value={due} onValueChange={setDue} today={TODAY} />
                <span className="text-xs text-fg-subtle">In 5 days</span>
              </dd>
            </dl>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive-ghost" className="mr-auto">
              Delete task
            </Button>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setTaskOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent size="form">
          <DialogBody>
            <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <DialogTitle>Start session</DialogTitle>
              <span className="text-sm text-fg-muted">For “Draft the beta waitlist email”</span>
            </div>
            <textarea
              aria-label="Prompt"
              rows={4}
              defaultValue="Draft the beta waitlist email"
              className="resize-none rounded-md border border-border bg-card px-3.5 py-3 font-mono text-sm text-fg outline-none focus:border-primary focus:ring-3 focus:ring-ring"
            />
            <dl className="grid grid-cols-4 items-center gap-x-4 gap-y-3 text-sm">
              <dt className="col-span-1 text-fg-muted">Repository</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={repo} onValueChange={setRepo} options={REPO_OPTIONS} aria-label="Repository" searchPlaceholder="Search repositories…" emptyText="No repository matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Host</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={host} onValueChange={setHost} options={HOST_OPTIONS} aria-label="Host" searchPlaceholder="Search hosts…" emptyText="No host matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Agent</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                {['Claude Code', 'Codex', 'OpenCode'].map((a) => (
                  <Chip key={a} variant="solid" selected={agent === a} onClick={() => setAgent(a)}>
                    {a}
                  </Chip>
                ))}
              </dd>
              <dt className="col-span-1 text-fg-muted">Model</dt>
              <dd className="col-span-3 m-0 flex flex-col gap-1.5">
                <span className="flex flex-wrap gap-1.5">
                  {['Opus 4.6', 'Sonnet 4.6', 'Haiku 4.5'].map((m) => (
                    <Chip key={m} variant="solid" selected={model === m} onClick={() => setModel(m)}>
                      {m}
                    </Chip>
                  ))}
                </span>
                <span className="text-xs text-fg-muted">Most efficient for everyday tasks</span>
              </dd>
            </dl>
            {host === 'fable' ? (
              <Callout>fable has been offline for 2 days. The session waits as Queued and starts when its runner reconnects.</Callout>
            ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <span className="mr-auto flex items-center gap-1 text-xs text-fg-subtle">
              <Kbd>⌘</Kbd>
              <Kbd>⏎</Kbd>
              to start
            </span>
            <Button variant="ghost" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setStartOpen(false)}>{host === 'fable' ? 'Queue session' : 'Start session'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ the session pane */

/**
 * The bar over a session's terminal: opened from the console, then from a
 * task (the way back leads), in each run state.
 */
export function SessionPaneHeaderDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader
          state="running"
          name="PR #121 porting to peersyst"
          stateLabel="Running"
          meta="claude-code · sonnet 4.6 · xrp-mobile"
        />
        <div className="h-28">
          <Terminal>
            <TerminalScrollback>
              <TerminalLine tone="dim">Working on it. Edited 3 files so far.</TerminalLine>
            </TerminalScrollback>
            <TerminalPrompt />
          </Terminal>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader
          state="needs-input"
          name="biometric-unlock"
          stateLabel="Needs input"
          meta="claude-code · opus 4.6 · xrp-mobile"
          back={<SessionPaneBack href="#taskboard">Biometric unlock on Android</SessionPaneBack>}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader state="failed" name="retriever eval" stateLabel="Failed" meta="codex · gpt-5 · atlas" />
      </div>
    </div>
  );
}
