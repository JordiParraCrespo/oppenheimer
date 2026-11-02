import { SessionPaneBack } from '@oppenheimer/design-system-web';
import { useSessionTasks } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * "Back to task" at the head of a session's bar (`18-plan-product.md` §4, the
 * frame's `taskTitle` before a slash): the title of the task the session is
 * on, opening Plan on it. With several, the task the session was started
 * from, else the one it was linked to last. Nothing for a session on no task.
 */
export function SessionTaskLink({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { data: tasks } = useSessionTasks(sessionId);
  const linkOf = (task: NonNullable<typeof tasks>[number]) =>
    task.sessions.find((link) => link.sessionId === sessionId);
  const task = [...(tasks ?? [])].sort((a, b) => {
    const left = linkOf(a);
    const right = linkOf(b);
    if (left?.origin !== right?.origin) return left?.origin === 'started' ? -1 : 1;
    return (right?.linkedAt.getTime() ?? 0) - (left?.linkedAt.getTime() ?? 0);
  })[0];
  if (!task) return null;

  return (
    <>
      <SessionPaneBack
        render={<Link to="/plan" search={{ task: task.id }} />}
        title={t('tasks.backToTask')}
      >
        {task.title}
      </SessionPaneBack>
      <span aria-hidden className="shrink-0 text-fg-subtle">
        /
      </span>
    </>
  );
}
