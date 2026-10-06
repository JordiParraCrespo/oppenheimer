import { TerminalStatusItem } from '@oppenheimer/design-system-web';
import { CircleCheck } from '@oppenheimer/design-system-web/icons';
import { useSessionTasks } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * "Back to task" in a session's status bar (`18-plan-product.md` §4): the
 * title of the task the session is on, opening Plan on it. With several, the
 * task the session was started from, else the one it was linked to last.
 * Nothing for a session on no task.
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
    <TerminalStatusItem>
      <Link
        to="/plan"
        search={{ task: task.id }}
        title={t('tasks.backToTask')}
        className="flex max-w-60 items-center gap-1.5 text-term-fg hover:underline"
      >
        <CircleCheck className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{task.title}</span>
      </Link>
    </TerminalStatusItem>
  );
}
