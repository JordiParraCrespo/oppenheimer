import { toast } from '@oppenheimer/design-system-web';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { useCreateSession, usePrepareSession } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewCheckout, toReviewSession } from '../lib/review-session';

/**
 * Starts a review session for a pull request and opens its terminal.
 *
 * `warm` asks the host to fetch the head branch and make a spare worktree
 * from it, once per host, when the reader reaches for the button, so the
 * create that follows cuts its branch from a checkout that already exists.
 * The idempotency key belongs to one host's attempt: a second press after a
 * lost answer is the same session, a press on another host is a new one.
 */
export function useReviewSession(pull: PullRequestDetailEntity) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const navigate = useNavigate();
  const warmed = useRef(new Set<string>());
  const attempt = useRef<{ hostId: string; key: string } | null>(null);
  const prepare = usePrepareSession();
  const create = useCreateSession({
    onSuccess: (session) => {
      attempt.current = null;
      navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
    },
    onError: (error) =>
      toast.error(resolveError(error, t('pullRequests.reviewSession.failed')).message),
  });

  return {
    pending: create.isPending,
    warm: (hostId: string) => {
      if (warmed.current.has(hostId)) return;
      warmed.current.add(hostId);
      // Best effort: a host that cannot get ready now still takes the create.
      prepare.mutate({ hostId, checkouts: [reviewCheckout(pull)] });
    },
    start: (hostId: string) => {
      if (attempt.current?.hostId !== hostId)
        attempt.current = { hostId, key: crypto.randomUUID() };
      create.mutate({
        input: toReviewSession(pull, hostId),
        idempotencyKey: attempt.current.key,
      });
    },
  };
}
