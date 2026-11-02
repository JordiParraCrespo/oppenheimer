'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';
import type { BotApprovalEntity } from '../modules/bots/bot-conversation.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/**
 * A bot's Needs input card (`product/versions/mvp/25-bots.md` §5): the one
 * call it waits on, and your answer to it. The chat reads it again when the
 * bot's stream says a card was raised or settled, or a turn ended.
 */

/**
 * The card the bot waits on; `null` when none does. It draws nothing while
 * it loads, so it is not a Suspense read: the chat is whole without it.
 */
export function useBotPendingApproval(id: string) {
  const app = useConsumerApp();
  return useQuery<BotApprovalEntity | null, Error>({
    queryKey: botsKeys.pendingApproval(id),
    queryFn: () => app.bots.findPendingApproval(id),
  });
}

/**
 * The workspace's pending cards across its bots, for the Inbox's combined
 * read: the key and the fetch. `botApproval.changed` refetches it.
 */
export function usePendingBotApprovalsQuery() {
  const app = useConsumerApp();
  return {
    queryKey: botsKeys.pendingApprovals(),
    queryFn: () => app.bots.findWorkspacePendingApprovals(),
  };
}

export interface DecideBotApprovalVariables {
  id: string;
  approvalId: string;
  /** One of the card's `details.decisions`. */
  decision: BotApprovalDecision;
  note?: string;
}

/**
 * Answers the card with one of the decisions it offers. The card and the
 * chat are read again: a yes or a no gives the bot a turn that reports what
 * came of it; a stop writes its line and gives none.
 */
export const useDecideBotApproval = mutation<BotApprovalEntity, DecideBotApprovalVariables>({
  run: (app, { id, approvalId, decision, note }) =>
    app.bots.decideApproval(id, approvalId, decision, note),
  update: (queryClient, _approval, { id }) =>
    Promise.all([
      // A yes that reached past the call changed what Settings → Permissions shows.
      queryClient.invalidateQueries({ queryKey: botsKeys.permissions(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
      // The Inbox's list across bots, which the workspace stream also announces.
      queryClient.invalidateQueries({ queryKey: botsKeys.pendingApprovals() }),
    ]),
});
