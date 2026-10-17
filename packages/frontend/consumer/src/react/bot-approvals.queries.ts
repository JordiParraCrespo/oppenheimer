'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotApprovalEntity } from '../modules/bots/bot-conversation.entity';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';

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

export interface DecideBotApprovalVariables {
  id: string;
  approvalId: string;
  decision: BotApprovalDecision;
  note?: string;
}

/**
 * Approves or denies the card. The card and the chat are read again: the
 * bot has a new turn queued that reports what came of it.
 */
export function useDecideBotApproval(
  options?: UseMutationOptions<BotApprovalEntity, Error, DecideBotApprovalVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalId, decision, note }: DecideBotApprovalVariables) =>
      app.bots.decideApproval(id, approvalId, decision, note),
    ...withCacheOnSuccess(options, (_approval, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) }),
        queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
      ]),
    ),
  });
}
