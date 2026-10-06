'use client';

import { Button } from '@oppenheimer/design-system-web/button';
import { DragProvider, type SortableGroups, SortableItem, useSortableGroups } from '@oppenheimer/design-system-web/drag';
import { GoalCard, GoalEmpty, GoalGrid } from '@oppenheimer/design-system-web/goal-card';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import { EllipsisIcon, PlusIcon } from '@oppenheimer/design-system-web/icons';
import {
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web/page-header';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';
import {
  TASK_STATUS_STATE,
  TaskBoard,
  TaskCard,
  TaskColumn,
  TaskColumnAdd,
  TaskComposer,
  TaskSessionChip,
  type TaskStatus,
} from '@oppenheimer/design-system-web/task-board';
import * as React from 'react';

import { COLUMNS } from './plan-fixtures';

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
    undefined,
    { live: true },
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
      <PageHeader>
        <PageHeaderRow
          size="display"
          title="Tasks"
          actions={
            <Button>
              <PlusIcon />
              New task
            </Button>
          }
        />
        <PageHeaderMeta indent={false}>
          <PageHeaderStat value={open}>open</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={(groups.doing ?? []).length}>in progress</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={doneIds.length}>done</PageHeaderStat>
          <PageHeaderSep />
          <PageHeaderStat value={1} tone="danger">
            overdue
          </PageHeaderStat>
        </PageHeaderMeta>
      </PageHeader>
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
        live
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

/** The four statuses on the run-state dots, as the column heads and the task dialog draw them. */
export function TaskStatusDots() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {COLUMNS.map((c) => (
        <StatusDot key={c.id} state={TASK_STATUS_STATE[c.id]} density="compact">
          {c.label}
        </StatusDot>
      ))}
    </div>
  );
}
