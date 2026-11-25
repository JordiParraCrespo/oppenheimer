import { useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Select } from '@oppenheimer/design-system-mobile/select';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  type BoardFilter,
  boardColumnsOf,
  boardCounts,
  cardView,
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
import { cardContext } from '../lib/card-context';
import { readsState, retryFailed } from '../lib/reads';
import { AddTask } from './add-task';
import { TaskCheck } from './task-check';

const ALL = 'all';
const DAY_TICK_MS = 60_000;

/**
 * Plan on the phone: the console's board as one list, its four columns in
 * order (Done keeping the past week, the rest a tap away), narrowed to a
 * project with the system's picker, the counts under the title, and Add task
 * at the foot of Not started, filing the task where the board is looking.
 * The board waits for the projects and milestones that name each row, and
 * fails with them, rather than drawing rows without where they are filed.
 * It waits for the sessions too, so chips do not pop in after the rows; a
 * sessions read that failed says so under the counts, with Try again, so
 * rows without a session chip are not taken for tasks no session works on.
 */
export function PlanBoard() {
  const { t, i18n } = useTranslation();
  const tasks = useTasks();
  const projectsRead = useProjects();
  const milestonesRead = useMilestones();
  const sessionsRead = useSessions();
  const { data: hosts } = useHosts();
  const projects = projectsRead.data;
  const milestones = milestonesRead.data;
  const board = [tasks, projectsRead, milestonesRead];
  const boardState = readsState(board);
  const sessionsState = readsState([sessionsRead]);
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

  if (boardState === 'pending' || sessionsState === 'pending') {
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

  if (boardState === 'failed') {
    return (
      <View className="items-start gap-3 px-5 pt-6">
        <Text variant="body" tone="destructive">
          {t('tasks.board.loadFailed')}
        </Text>
        <Button variant="outline" onPress={() => retryFailed(board)}>
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
  const sessionsById = new Map((sessionsRead.data ?? []).map((session) => [session.id, session]));
  const hostsById = new Map((hosts ?? []).map((host) => [host.id, host]));
  const context = cardContext({
    filter,
    today,
    locale,
    words: {
      today: t('tasks.dates.today'),
      tomorrow: t('tasks.dates.tomorrow'),
      yesterday: t('tasks.dates.yesterday'),
    },
    projects: projects ?? [],
    milestones: milestones ?? [],
  });

  const row = (task: TaskEntity, index: number) => {
    const line = sessionLineOf(task, sessionsById, hostsById);
    const view = cardView(task, context);
    const filed = [view.projectName, view.milestoneName].filter(Boolean).join(' · ');
    return (
      <Link key={task.id} href={`/tasks/${task.id}`} asChild>
        <Pressable accessibilityRole="button" className="active:bg-surface-hover">
          <TaskRow
            first={index === 0}
            title={view.title}
            done={view.done}
            filed={filed || null}
            due={view.due ? { text: view.due, tone: view.dueTone } : null}
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
      {sessionsState === 'failed' ? (
        <View className="flex-row items-center gap-3 px-5 pt-2">
          <Text variant="caption" tone="destructive" className="flex-1">
            {t('sessions.sidebar.loadFailed')}
          </Text>
          <Button variant="outline" size="sm" onPress={() => sessionsRead.refetch()}>
            <Text>{t('common.retry')}</Text>
          </Button>
        </View>
      ) : null}
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
                  onPress={() => setShowOlder((shown) => !shown)}
                  accessibilityRole="button"
                  className={
                    columns[status].length > 0
                      ? 'border-t border-border-subtle px-4 py-3'
                      : 'px-4 py-3'
                  }
                >
                  <Text variant="caption" tone="accent">
                    {showOlder
                      ? t('tasks.board.hideOlder')
                      : t('tasks.board.showOlder', { count: folded[status] })}
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
