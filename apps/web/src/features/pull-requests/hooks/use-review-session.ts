import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { usePrepareSession, useStartReviewSession } from '@oppenheimer/frontend-consumer/react';
import { useRef } from 'react';
import { reviewCheckout } from '../lib/review-session';

/**
 * Starts a pull request's review session. Once it answers, the Chat tab reads
 * it from the For review list and draws its terminal.
 *
 * `warm` asks the host to fetch the head branch and make a spare worktree
 * from it, once per host, when the reader reaches for the button, so the start
 * that follows cuts its branch from a checkout that already exists. The
 * idempotency key belongs to one host's attempt and an answer spends it: a
 * start that failed closed what it had made, so the next press starts afresh,
 * and a press on another host is a new one.
 */
export function useReviewSession(pull: PullRequestDetailEntity) {
  const warmed = useRef(new Set<string>());
  const attempt = useRef<{ hostId: string; key: string } | null>(null);
  const prepare = usePrepareSession();
  const start = useStartReviewSession({
    onSuccess: () => {
      attempt.current = null;
    },
    onError: () => {
      // A start the API refused closed whatever it had made, so the next press
      // is a new attempt with a key of its own.
      attempt.current = null;
    },
  });

  return {
    pending: start.isPending,
    /** The last start's failure, drawn beside the button until the next press. */
    error: start.error,
    warm: (hostId: string) => {
      if (warmed.current.has(hostId)) return;
      warmed.current.add(hostId);
      // Best effort: a host that cannot get ready now still takes the start.
      prepare.mutate({ hostId, checkouts: [reviewCheckout(pull)] });
    },
    start: (hostId: string) => {
      if (attempt.current?.hostId !== hostId)
        attempt.current = { hostId, key: crypto.randomUUID() };
      start.mutate({ address: pull.address, hostId, idempotencyKey: attempt.current.key });
    },
  };
}
