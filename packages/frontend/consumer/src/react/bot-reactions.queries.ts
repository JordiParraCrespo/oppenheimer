'use client';

import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BotConversationEntity,
  BotMessageEntity,
} from '../modules/bots/bot-conversation.entity';
import { type BotOlderMessages, olderWithReaction } from '../modules/bots/older-messages';
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
  // On the window, or on the older pages the reader scrolled up into, wherever the message is.
  const setReaction = (id: string, messageId: string, emoji: string | null) => {
    queryClient.setQueryData<BotConversationEntity>(botsKeys.conversation(id), (conversation) =>
      conversation?.withReaction(messageId, emoji),
    );
    queryClient.setQueryData<BotOlderMessages | null>(botsKeys.olderMessages(id), (older) =>
      olderWithReaction(older, messageId, emoji),
    );
  };
  const reactionOf = (id: string, messageId: string): string | null => {
    const lines = [
      ...(queryClient.getQueryData<BotConversationEntity>(botsKeys.conversation(id))?.messages ??
        []),
      ...(queryClient.getQueryData<BotOlderMessages | null>(botsKeys.olderMessages(id))?.messages ??
        []),
    ];
    return lines.find((message) => message.id === messageId)?.reaction ?? null;
  };
  return useMutation({
    ...options,
    mutationFn: ({ id, messageId, emoji }: ReactToBotMessageVariables) =>
      app.bots.react(id, messageId, emoji),
    onMutate: async ({ id, messageId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: botsKeys.conversation(id) });
      const before = reactionOf(id, messageId);
      setReaction(id, messageId, emoji);
      return { before };
    },
    onError: (error, variables, context, mutation) => {
      if (context) setReaction(variables.id, variables.messageId, context.before);
      return options?.onError?.(error, variables, context, mutation);
    },
  });
}
