'use client';

import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BotConversationEntity,
  BotMessageEntity,
} from '../modules/bots/bot-conversation.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

export interface ReactToBotMessageVariables {
  id: string;
  messageId: string;
  /** One emoji; `null` takes the reaction back. */
  emoji: string | null;
}

/**
 * Your reaction to a message in a bot's chat. The chat shows it at once and
 * puts back the one before if the API refuses it; nothing else is read again,
 * since the bot is not woken by a reaction.
 */
export function useReactToBotMessage(
  options?: Omit<
    UseMutationOptions<
      BotMessageEntity,
      Error,
      ReactToBotMessageVariables,
      { before: string | null }
    >,
    'mutationFn' | 'onMutate'
  >,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const setReaction = (id: string, messageId: string, emoji: string | null) =>
    queryClient.setQueryData<BotConversationEntity>(botsKeys.conversation(id), (conversation) =>
      conversation?.withReaction(messageId, emoji),
    );
  return useMutation({
    ...options,
    mutationFn: ({ id, messageId, emoji }: ReactToBotMessageVariables) =>
      app.bots.react(id, messageId, emoji),
    onMutate: async ({ id, messageId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: botsKeys.conversation(id) });
      const before =
        queryClient
          .getQueryData<BotConversationEntity>(botsKeys.conversation(id))
          ?.messages.find((message) => message.id === messageId)?.reaction ?? null;
      setReaction(id, messageId, emoji);
      return { before };
    },
    onError: (error, variables, context, mutation) => {
      if (context) setReaction(variables.id, variables.messageId, context.before);
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}
