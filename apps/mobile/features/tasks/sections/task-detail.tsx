import { useNow } from '@oppenheimer/design-system-mobile';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { type TaskEntity, taskSessionsOf } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useMilestones,
  useProjects,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { todayIn } from '@oppenheimer/frontend-core';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { DetailCard } from '../components/detail-card';
import { DetailLine } from '../components/detail-line';
import { SessionChip } from '../components/session-chip';
import { dueOf } from '../lib/task-due';
import { TaskCheck } from './task-check';
import { TaskStatusPicker } from './task-status';

const DAY_TICK_MS = 60_000;

/**
 * A task's page on the phone: its title with the done check, its notes, its
 * column (the system's picker), where it is filed and when it is due, and the
 * sessions working on it, each opening its session.
 */
export function TaskDetail({ task }: { task: TaskEntity }) {
  const { t, i18n } = useTranslation();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: sessions } = useSessions();
  const { data: hosts } = useHosts();
  const today = todayIn(useNow(DAY_TICK_MS));
  const project = projects?.find((row) => row.id === task.projectId);
  const milestone = task.milestoneId
    ? milestones?.find((row) => row.id === task.milestoneId)
    : null;
  const due = dueOf(task, today, i18n.resolvedLanguage ?? 'en', {
    today: t('tasks.dates.today'),
    tomorrow: t('tasks.dates.tomorrow'),
    yesterday: t('tasks.dates.yesterday'),
  });
  const working = taskSessionsOf(
    task,
    new Map((sessions ?? []).map((session) => [session.id, session])),
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
        {due ? (
          <DetailLine
            label={t('tasks.mobile.due')}
            value={due.text}
            tone={due.tone === 'overdue' ? 'destructive' : undefined}
            first={false}
          />
        ) : null}
      </DetailCard>

      <DetailCard title={t('tasks.mobile.sessions')}>
        {working.length === 0 ? (
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
