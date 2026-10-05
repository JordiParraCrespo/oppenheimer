import { Button, dotVariants, IconButton } from '@oppenheimer/design-system-web';
import { Link2, Play, X } from '@oppenheimer/design-system-web/icons';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessions, useUnlinkTaskSession } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, RelativeTime } from '@oppenheimer/frontend-web';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SESSION_DOT } from '../components/task-session-line';
import { LinkSessionPicker } from '../dialogs/link-session';
import { sessionStateOf } from '../lib/session-state';

const board = getRouteApi('/_authenticated/plan/');

/**
 * The task dialog's Sessions row (`18-plan-product.md` §4): each linked
 * session with its state and age, opening it, × to unlink; then Start session
 * and Link existing. Both of those attach, and attaching is what moves a task
 * out of Later or To do.
 */
export function TaskSessionsRow({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const navigate = board.useNavigate();
  const { data: sessions } = useSessions({
    select: (rows) => new Map(rows.map((row) => [row.id, row])),
  });
  const { data: hosts } = useHosts({ select: (rows) => new Map(rows.map((row) => [row.id, row])) });
  const unlink = useUnlinkTaskSession();
  const [linking, setLinking] = useState(false);
  const linked = task.sessions.flatMap((link) => {
    const session = sessions?.get(link.sessionId);
    return session ? [{ link, session }] : [];
  });

  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-3">
      <span className="pt-1 text-sm text-fg-muted">{t('tasks.dialog.sessions')}</span>
      <div className="flex min-w-0 flex-col gap-1.5">
        {linked.map(({ link, session }) => {
          const state = sessionStateOf(session, hosts?.get(session.hostId)?.online);
          return (
            <div
              key={session.id}
              className="flex min-w-0 items-center gap-2 rounded-sm bg-hover-surface py-1 pr-1 pl-2 text-sm"
            >
              <span className={dotVariants({ state: SESSION_DOT[state] })} aria-hidden />
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: session.id }}
                className="min-w-0 flex-1 truncate font-mono text-fg hover:underline"
              >
                {session.name}
              </Link>
              <span className="shrink-0 text-xs text-fg-muted">
                {t(`tasks.sessionState.${state}`)}
              </span>
              <span className="figures shrink-0 font-mono text-xs text-fg-subtle">
                <RelativeTime date={link.linkedAt} />
              </span>
              <IconButton
                type="button"
                size="sm"
                aria-label={t('tasks.dialog.unlink', { name: session.name })}
                disabled={unlink.isPending}
                onClick={() => unlink.mutate({ id: task.id, sessionId: session.id })}
              >
                <X />
              </IconButton>
            </div>
          );
        })}
        <ErrorAlert
          error={unlink.error}
          fallback={t('tasks.dialog.unlinkFailed')}
          onDismiss={unlink.reset}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={task.isDone}
            onClick={() =>
              navigate({ search: (previous) => ({ ...previous, task: undefined, start: task.id }) })
            }
          >
            <Play />
            {t('tasks.dialog.startSession')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinking(true)}>
            <Link2 />
            {t('tasks.dialog.linkExisting')}
          </Button>
        </div>
      </div>
      {linking ? <LinkSessionPicker task={task} onClose={() => setLinking(false)} /> : null}
    </div>
  );
}
