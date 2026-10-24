import { IconButton } from '@oppenheimer/design-system-web';
import { Trash2, X } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress, ReviewSession } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useSuspensePullRequestAndReviewSessions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteReviewSessionDialog } from '../dialogs/delete-review-session';
import { latestReview } from '../lib/review-session';
import { ReviewSessionStart } from './review-session-start';

/**
 * The Chat tab: the pull request's review session, a terminal under its bar
 * (`review · repo #n`, the head branch, the host, and × back to the
 * description; whether it is live is the terminal's own status bar), or, before there is one, the panel that starts it. The
 * terminal is the sessions feature's, so the route hands it in as `terminal`.
 * It reads the pull request and the review sessions under Suspense, side by
 * side. The bar's bin deletes the session; its dialog sits outside both
 * branches, since the delete swaps the terminal for the start panel at once.
 *
 * The bar stands on whatever ground the session's pane shows: the terminal's
 * while it is a terminal, the chat's own, the console's, once the pane reads
 * as a chat (`data-pane-ground`), so bar and chat are one surface rather
 * than a chat set in a terminal-coloured box.
 */
export function PullRequestChat({
  address,
  terminal,
  onClose,
}: {
  address: PullRequestAddress;
  terminal: (sessionId: string) => ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pull, reviewSessions, error } = useSuspensePullRequestAndReviewSessions(address);
  const session = latestReview(reviewSessions, address);
  const [deleting, setDeleting] = useState<ReviewSession | null>(null);
  const { data: hostName } = useHosts({
    select: (hosts) => hosts.find((host) => host.id === session?.hostId)?.name,
  });

  return (
    <>
      {session ? (
        <div className="group/review flex min-h-0 flex-1 flex-col bg-term-bg has-[[data-pane-ground=chat]]:bg-transparent">
          <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-term-border pr-3 pl-4 font-mono text-xs text-term-dim group-has-[[data-pane-ground=chat]]/review:border-border-subtle group-has-[[data-pane-ground=chat]]/review:text-fg-muted">
            <span className="text-term-fg group-has-[[data-pane-ground=chat]]/review:text-fg">
              {t('pullRequests.reviewSession.bar', {
                repository: session.repository.split('/').pop(),
                number: session.number,
              })}
            </span>
            <span className="truncate">
              {[session.headRef, hostName].filter(Boolean).join(' · ')}
            </span>
            <span className="flex-1" />
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t('pullRequests.reviewSession.delete')}
              title={t('pullRequests.reviewSession.delete')}
              onClick={() => setDeleting(session)}
            >
              <Trash2 />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t('pullRequests.reviewSession.close')}
              title={t('pullRequests.reviewSession.close')}
              onClick={onClose}
            >
              <X />
            </IconButton>
          </div>
          <ErrorAlert error={error} fallback={t('pullRequests.reviewSession.loadFailed')} />
          <div className="flex min-h-0 flex-1 flex-col">{terminal(session.sessionId)}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <ErrorAlert error={error} fallback={t('pullRequests.reviewSession.loadFailed')} />
          <ReviewSessionStart pull={pull} />
        </div>
      )}
      {deleting ? (
        <DeleteReviewSessionDialog session={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </>
  );
}
