import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleOff, RotateCcw, Terminal } from '@oppenheimer/design-system-web/icons';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A session whose terminal is gone: stopped or deleted.
 *
 * Stopped is not the end of the work, and this used to read as though it were:
 * one sentence and a way to start something else. What actually happened is
 * that the pane exited — the worktree is still there, on its branch, and the
 * agent still holds the conversation, which is why Restart brings back what was
 * said rather than an empty terminal. So the branch is named, because it is the
 * one thing a reader might go looking for, and Restart leads.
 *
 * Deleted is the end: the worktree is gone from the host, so there is nothing
 * to restart and the caller passes no `onRestart`.
 */
export function SessionClosed({
  name,
  copy,
  branch,
  newSession,
  onRestart,
  restarting,
}: {
  name: string;
  copy: 'sessions.closed.description' | 'sessions.closed.deleted';
  /** The session's branch, when it still has one to point at. */
  branch?: string | null;
  newSession: ReactElement;
  /** Absent: there is nothing to restart (a deleted session). */
  onRestart?: () => void;
  restarting?: boolean;
}) {
  const { t } = useTranslation();
  // The stopped sentence names the branch; with none to name it says the same
  // thing without a gap where a name should be.
  const description =
    copy === 'sessions.closed.description' && !branch
      ? t('sessions.closed.descriptionNoBranch')
      : t(copy, { branch });

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleOff />
        </EmptyState.Media>
        <EmptyState.Title>{name}</EmptyState.Title>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        {onRestart ? (
          <Button
            onClick={onRestart}
            pending={restarting}
            pendingLabel={t('sessions.closed.restarting')}
          >
            <RotateCcw />
            {t('sessions.closed.restart')}
          </Button>
        ) : null}
        <Button variant="secondary" render={newSession}>
          <Terminal />
          {t('nav.newSession')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
