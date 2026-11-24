import { useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cardView, type TaskEntity, taskSessionsOf } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useMilestones,
  useProjects,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { todayIn } from '@oppenheimer/frontend-core';
import { RecordState } from '@oppenheimer/frontend-mobile';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { DetailCard } from '../components/detail-card';
import { DetailLine } from '../components/detail-line';
import { SessionChip } from '../components/session-chip';
import { cardContext } from '../lib/card-context';
import { readsState, retryFailed } from '../lib/reads';
import { TaskCheck } from './task-check';
import { TaskStatusPicker } from './task-status';

const DAY_TICK_MS = 60_000;

/**
 * A task's page on the phone: its title with the done check, its notes, its
 * column (the system's picker), where it is filed and when it is due, and the
 * sessions working on it, each opening its session. Until the projects and
 * milestones that name where it is filed have answered, the page waits (or
 * says they failed) rather than drawing blank names; the sessions card does
 * the same for the sessions, so a read that failed never says "No sessions".
 */
export function TaskDetail({ task }: { task: TaskEntity }) {
  const { t, i18n } = useTranslation();
  const projectsRead = useProjects();
  const milestonesRead = useMilestones();
  const sessionsRead = useSessions();
  const { data: hosts } = useHosts();
  const today = todayIn(useNow(DAY_TICK_MS));
  const names = [projectsRead, milestonesRead];
  const namesState = readsState(names);
  const sessionsState = readsState([sessionsRead]);

  if (namesState !== 'ready') {
    return (
      <RecordState
        pending={namesState === 'pending'}
        failed={namesState === 'failed' ? t('tasks.mobile.loadFailed') : null}
        onRetry={() => retryFailed(names)}
        notFound={t('tasks.mobile.notFound')}
      />
    );
  }

  const projects = projectsRead.data ?? [];
  const milestones = milestonesRead.data ?? [];
  const project = projects.find((row) => row.id === task.projectId);
  const milestone = task.milestoneId ? milestones.find((row) => row.id === task.milestoneId) : null;
  const view = cardView(
    task,
    cardContext({
      filter: {},
      today,
      locale: i18n.resolvedLanguage ?? 'en',
      words: {
        today: t('tasks.dates.today'),
        tomorrow: t('tasks.dates.tomorrow'),
        yesterday: t('tasks.dates.yesterday'),
      },
      projects,
      milestones,
    }),
  );
  const working = taskSessionsOf(
    task,
    new Map((sessionsRead.data ?? []).map((session) => [session.id, session])),
    new Map((hosts ?? []).map((host) => [host.id, host])),
  );

  return (
    <ScrollView contentContainerClassName="pb-10">
      <View className="flex-row items-start gap-3 px-5 pt-4">
        <TaskCheck task={task} />
        <Text className="flex-1 text-[22px] font-semibold leading-7" selectable>
          {task.title}
        </Text>
      </View>

      {task.notes ? (
        <DetailCard title={t('tasks.dialog.notesLabel')}>
          <Text variant="body" className="px-4 py-3" selectable>
            {task.notes}
          </Text>
        </DetailCard>
      ) : null}

      <DetailCard title={null}>
        <DetailLine label={t('tasks.dialog.status')} first>
          <TaskStatusPicker task={task} />
        </DetailLine>
        <DetailLine
          label={t('tasks.dialog.project')}
          value={project?.isUnassigned ? t('tasks.sidebar.unassigned') : (project?.name ?? '')}
          first={false}
        />
        {milestone ? (
          <DetailLine label={t('tasks.dialog.milestone')} value={milestone.name} first={false} />
        ) : null}
        {view.due ? (
          <DetailLine
            label={t('tasks.mobile.due')}
            value={view.due}
            tone={view.dueTone === 'overdue' ? 'destructive' : undefined}
            first={false}
          />
        ) : null}
      </DetailCard>

      <DetailCard title={t('tasks.mobile.sessions')}>
        {sessionsState === 'pending' ? (
          <View className="items-start px-4 py-3" aria-busy>
            <ActivityIndicator />
          </View>
        ) : sessionsState === 'failed' ? (
          <View className="items-start gap-3 px-4 py-3">
            <Text variant="caption" tone="destructive">
              {t('sessions.sidebar.loadFailed')}
            </Text>
            <Button variant="outline" size="sm" onPress={() => sessionsRead.refetch()}>
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        ) : working.length === 0 ? (
          <Text variant="caption" className="px-4 py-3">
            {t('tasks.mobile.noSessions')}
          </Text>
        ) : (
          working.map(({ session, state }, index) => (
            <Link key={session.id} href={`/sessions/${session.id}`} asChild>
              <Pressable
                accessibilityRole="link"
                className={
                  index === 0
                    ? 'px-4 py-3 active:bg-surface-hover'
                    : 'border-t border-border-subtle px-4 py-3 active:bg-surface-hover'
                }
              >
                <SessionChip
                  state={state}
                  word={t(`tasks.sessionState.${state}`)}
                  name={session.name}
                  others={0}
                />
              </Pressable>
            </Link>
          ))
        )}
      </DetailCard>
    </ScrollView>
  );
}
