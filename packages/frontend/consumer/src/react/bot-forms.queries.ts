'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { BotFormValues } from '@oppenheimer/shared/schemas/bot';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotFormCardEntity } from '../modules/bots/bot-conversation.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

/**
 * A form a bot asked you to fill (`ask_form`): its fields, and what you send.
 * The chat reads it again when the bot's stream says a form was raised or
 * settled.
 */

/**
 * The form the bot waits on; `null` when none does. It draws nothing while
 * it loads, so it is not a Suspense read: the chat is whole without it.
 */
export function useBotPendingForm(id: string) {
  const app = useConsumerApp();
  return useQuery<BotFormCardEntity | null, Error>({
    queryKey: botsKeys.pendingForm(id),
    queryFn: () => app.bots.findPendingForm(id),
  });
}

/** The form and the chat are read again: the bot has a new turn queued that carries on. */
function useSettleForm() {
  const queryClient = useQueryClient();
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: botsKeys.pendingForm(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    ]);
}

export interface SubmitBotFormVariables {
  id: string;
  formId: string;
  /** A value per field id. */
  values: Readonly<BotFormValues>;
}

/** Sends the form: the bot's next turn reads the values. */
export function useSubmitBotForm(
  options?: UseMutationOptions<BotFormCardEntity, Error, SubmitBotFormVariables>,
) {
  const app = useConsumerApp();
  const settle = useSettleForm();
  return useMutation({
    mutationFn: ({ id, formId, values }: SubmitBotFormVariables) =>
      app.bots.submitForm(id, formId, values),
    ...withCacheOnSuccess(options, (_card, { id }) => settle(id)),
  });
}

/** Dismisses the form: the bot is told, and not to ask again. */
export function useDismissBotForm(
  options?: UseMutationOptions<BotFormCardEntity, Error, { id: string; formId: string }>,
) {
  const app = useConsumerApp();
  const settle = useSettleForm();
  return useMutation({
    mutationFn: ({ id, formId }: { id: string; formId: string }) =>
      app.bots.dismissForm(id, formId),
    ...withCacheOnSuccess(options, (_card, { id }) => settle(id)),
  });
}
