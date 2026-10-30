'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { BotQuestionAnswer } from '@oppenheimer/shared/schemas/bot';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotQuestionCardEntity } from '../modules/bots/bot-conversation.entity';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';

/**
 * A bot's card of questions (`ask_user`, `product/versions/mvp/25-bots.md`
 * §3.2): what it asked, and your answers. The chat reads it again when the
 * bot's stream says a card was raised or settled.
 */

/**
 * The card the bot waits on; `null` when none does. It draws nothing while
 * it loads, so it is not a Suspense read: the chat is whole without it.
 */
export function useBotPendingQuestion(id: string) {
  const app = useConsumerApp();
  return useQuery<BotQuestionCardEntity | null, Error>({
    queryKey: botsKeys.pendingQuestion(id),
    queryFn: () => app.bots.findPendingQuestion(id),
  });
}

/** The card and the chat are read again: the bot has a new turn queued that carries on. */
function useSettleQuestion() {
  const queryClient = useQueryClient();
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: botsKeys.pendingQuestion(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    ]);
}

export interface AnswerBotQuestionVariables {
  id: string;
  questionId: string;
  /** One per question, in order. */
  answers: readonly BotQuestionAnswer[];
}

/** Answers the card: the bot's next turn reads the answers. */
export function useAnswerBotQuestion(
  options?: UseMutationOptions<BotQuestionCardEntity, Error, AnswerBotQuestionVariables>,
) {
  const app = useConsumerApp();
  const settle = useSettleQuestion();
  return useMutation({
    mutationFn: ({ id, questionId, answers }: AnswerBotQuestionVariables) =>
      app.bots.answerQuestion(id, questionId, answers),
    ...withCacheOnSuccess(options, (_card, { id }) => settle(id)),
  });
}

/** Dismisses the card: the bot is told, and not to ask again. */
export function useDismissBotQuestion(
  options?: UseMutationOptions<BotQuestionCardEntity, Error, { id: string; questionId: string }>,
) {
  const app = useConsumerApp();
  const settle = useSettleQuestion();
  return useMutation({
    mutationFn: ({ id, questionId }: { id: string; questionId: string }) =>
      app.bots.dismissQuestion(id, questionId),
    ...withCacheOnSuccess(options, (_card, { id }) => settle(id)),
  });
}
