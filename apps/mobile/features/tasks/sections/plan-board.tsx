import { useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Select } from '@oppenheimer/design-system-mobile/select';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  type BoardFilter,
  boardColumnsOf,
  boardCounts,
  doneCutoffOf,
  sessionLineOf,
  type TaskEntity,
} from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useMilestones,
  useProjects,
  useSessions,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { todayIn } from '@oppenheimer/frontend-core';
import { ListGroup } from '@oppenheimer/frontend-mobile';
import { TASK_STATUSES } from '@oppenheimer/shared/schemas/task';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SessionChip } from '../components/session-chip';
import { TaskRow } from '../components/task-row';
import { TaskRowSkeleton } from '../components/task-row-skeleton';
import { dueOf } from '../lib/task-due';
import { AddTask } from './add-task';
import { TaskCheck } from './task-check';

const ALL = 'all';
const DAY_TICK_MS = 60_000;

/**
 * Plan on the phone: the console's board as one list, its four columns in
 * order (Done keeping the past week, the rest a tap away), narrowed to a
 * project with the system's picker, the counts under the title, and Add task
 * at the foot of Not started, filing the task where the board is looking.
 */
export function PlanBoard() {
  const { t, i18n } = useTranslation();
  const tasks = useTasks();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: sessions } = useSessions();
  const { data: hosts } = useHosts();
  const [project, setProject] = useState<string>(ALL);
  const [showOlder, setShowOlder] = useState(false);
  const today = todayIn(useNow(DAY_TICK_MS));
  const locale = i18n.resolvedLanguage ?? 'en';
  const filter: BoardFilter = project === ALL ? {} : { projectIds: [project] };

  const picker = (
    <View className="flex-row items-center justify-between px-4 pt-2">
      <Select
        value={project}
        options={[
          { label: t('sessions.filters.shownAll'), value: ALL },
          ...(projects ?? []).map((row) => ({
            label: row.isUnassigned ? t('tasks.sidebar.unassigned') : row.name,
            value: row.id,
          })),
        ]}
        onValueChange={setProject}
      />
    </View>
  );

  if (tasks.isPending) {
    return (
      <View aria-busy>
        {picker}
        <ListGroup title={t('tasks.columns.todo')} count={null}>
          {[0, 1, 2].map((index) => (
            <TaskRowSkeleton key={index} first={index === 0} />
          ))}
        </ListGroup>
      </View>
    );
  }

  if (tasks.isError && !tasks.data) {
    return (
      <View className="items-start gap-3 px-5 pt-6">
        <Text variant="body" tone="destructive">
          {t('tasks.board.loadFailed')}
        </Text>
        <Button variant="outline" onPress={() => tasks.refetch()}>
          <Text>{t('common.retry')}</Text>
        </Button>
      </View>
    );
  }

  const rows = tasks.data ?? [];
  const { columns, folded } = boardColumnsOf(rows, filter, {
    cutoff: doneCutoffOf(today),
    showOlder,
  });
  const counts = boardCounts(rows, filter, today);
  const sessionsById = new Map((sessions ?? []).map((session) => [session.id, session]));
  const hostsById = new Map((hosts ?? []).map((host) => [host.id, host]));
  const projectName = (id: string) => {
    const row = projects?.find((candidate) => candidate.id === id);
    return row?.isUnassigned ? null : (row?.name ?? null);
  };
  const milestoneName = (id: string | null) =>
    id ? (milestones?.find((candidate) => candidate.id === id)?.name ?? null) : null;
  const dayWords = {
    today: t('tasks.dates.today'),
    tomorrow: t('tasks.dates.tomorrow'),
    yesterday: t('tasks.dates.yesterday'),
  };

  const row = (task: TaskEntity, index: number) => {
    const line = sessionLineOf(task, sessionsById, hostsById);
    const filed = [
      project === ALL ? projectName(task.projectId) : null,
      milestoneName(task.milestoneId),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <Link key={task.id} href={`/tasks/${task.id}`} asChild>
        <Pressable accessibilityRole="button" className="active:bg-surface-hover">
          <TaskRow
            first={index === 0}
            title={task.title}
            done={task.isDone}
            filed={filed || null}
            due={dueOf(task, today, locale, dayWords)}
            check={<TaskCheck task={task} />}
            session={
              line && !task.isDone ? (
                <Link href={`/sessions/${line.sessionId}`} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={t('tasks.card.openSession', { name: line.name })}
                  >
                    <SessionChip
                      state={line.state}
                      word={t(`tasks.sessionState.${line.state}`)}
                      name={line.name}
                      others={line.others}
                    />
                  </Pressable>
                </Link>
              ) : null
            }
          />
        </Pressable>
      </Link>
    );
  };

  return (
    <View className="flex-1">
      {picker}
      <Text variant="caption" className="px-5 pt-2">
        {[
          `${counts.open} ${t('tasks.board.stats.open')}`,
          `${counts.doing} ${t('tasks.board.stats.doing')}`,
          `${counts.done} ${t('tasks.board.stats.done')}`,
        ].join(' · ')}
        {counts.overdue > 0 ? (
          <Text variant="caption" tone="destructive">
            {` · ${counts.overdue} ${t('tasks.board.stats.overdue')}`}
          </Text>
        ) : null}
      </Text>
      <View className="pb-6">
        {TASK_STATUSES.map((status) =>
          status === 'todo' || columns[status].length > 0 || folded[status] ? (
            <ListGroup
              key={status}
              title={t(`tasks.columns.${status}`)}
              count={columns[status].length}
            >
              {columns[status].map(row)}
              {status === 'todo' ? (
                <AddTask
                  filter={filter}
                  milestones={milestones ?? []}
                  projects={projects ?? []}
                  first={columns.todo.length === 0}
                />
              ) : null}
              {folded[status] ? (
                <Pressable
                  onPress={() => setShowOlder(true)}
                  accessibilityRole="button"
                  className={
                    columns[status].length > 0
                      ? 'border-t border-border-subtle px-4 py-3'
                      : 'px-4 py-3'
                  }
                >
                  <Text variant="caption" tone="accent">
                    {t('tasks.board.showOlder', { count: folded[status] })}
                  </Text>
                </Pressable>
              ) : null}
            </ListGroup>
          ) : null,
        )}
      </View>
    </View>
  );
}
