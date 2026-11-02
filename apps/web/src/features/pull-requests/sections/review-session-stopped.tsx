import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleOff, RotateCcw } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A review session whose terminal has stopped (the host restarted, the agent
 * was quit), in the Chat tab. The sessions feature's own stopped pane offers
 * New session beside Restart, which is the wrong way out of a review: the way
 * back is this pull request's own session, and Restart reopens Claude Code on
 * the conversation it had, so the review carries on rather than starting over.
 * It names no branch: the worktree's is the session's own, cut from the head
 * branch the bar already names, and would read as a branch of the pull request.
 */
export function ReviewSessionStopped({
  name,
  restart,
  restarting,
}: {
  name: string;
  restart: () => void;
  restarting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleOff />
        </EmptyState.Media>
        <EmptyState.Title>{name}</EmptyState.Title>
        <EmptyState.Description>{t('pullRequests.reviewSession.stopped')}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button
          onClick={restart}
          pending={restarting}
          pendingLabel={t('pullRequests.reviewSession.restarting')}
        >
          <RotateCcw />
          {t('pullRequests.reviewSession.restart')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
