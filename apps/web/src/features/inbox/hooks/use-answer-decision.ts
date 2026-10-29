import { type InboxItem, sessionItemKey } from '@oppenheimer/frontend-consumer';
import { useAnswerSessionDecision } from '@oppenheimer/frontend-consumer/react';
import type { AnswerSessionDecisionDto } from '@oppenheimer/shared/schemas/session-decision';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';

/**
 * Answers what a session in the pane waits on (`29-inbox.md` slice 4). On
 * success the item leaves at once: the
 * decision's occurrence and the plain wait the session falls back to are both
 * answered for this visit, since the agent stays blocked until the host sees
 * the keys land, and a card that only opens the session would flash in
 * between. A follow-up question is a new occurrence and still comes.
 */
export function useAnswerDecision(item: Extract<InboxItem, { kind: 'session' }>) {
  const mutation = useAnswerSessionDecision();
  const { session } = item;

  const send = (answer: AnswerSessionDecisionDto) =>
    mutation.mutate(
      { sessionId: session.id, answer },
      {
        onSuccess: (answered) => {
          inboxVisit.answered(item.key);
          inboxVisit.answered(sessionItemKey(answered));
        },
      },
    );

  return { send, pending: mutation.isPending, error: mutation.error, reset: mutation.reset };
}
