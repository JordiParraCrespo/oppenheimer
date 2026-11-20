'use client';

import { useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotRoutineEntity, IssuedBotRoutineWebhook } from '../modules/bots/bot.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { usePollWhile } from './live-poll';

/**
 * A bot's routines: the Routines tab's list and what it does to one. The list
 * hangs under the bot's detail key, so deleting the bot drops it, and every
 * write here settles the same way: the list is read again, which carries each
 * routine's next run from now.
 */

/** A bot's routines, oldest first, under a Suspense `QueryState`, polling while one runs. */
export function useSuspenseBotRoutines(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotRoutineEntity[], Error>({
    queryKey: botsKeys.routineList(id),
    queryFn: () => app.bots.findRoutines(id),
    ...usePollWhile<BotRoutineEntity[]>(
      'liveRun',
      botsKeys.routineList(id),
      (rows) => rows?.some((routine) => routine.isRunning) ?? false,
    ),
  });
}

/** Every bot's routines in the workspace (`/automations`), polling while one runs. */
export function useSuspenseAllBotRoutines() {
  const app = useConsumerApp();
  return useSuspenseQuery<BotRoutineEntity[], Error>({
    queryKey: botsKeys.allRoutines(),
    queryFn: () => app.bots.findAllRoutines(),
    ...usePollWhile<BotRoutineEntity[]>(
      'liveRun',
      botsKeys.allRoutines(),
      (rows) => rows?.some((routine) => routine.isRunning) ?? false,
    ),
  });
}

export interface BotRoutineVariables {
  id: string;
  routineId: string;
}

export interface SetBotRoutineEnabledVariables extends BotRoutineVariables {
  enabled: boolean;
}

export interface RunBotRoutineVariables extends BotRoutineVariables {
  /** One per click, so a retried request is the same run. */
  idempotencyKey: string;
}

export interface IssueBotRoutineWebhookVariables extends BotRoutineVariables {
  /** Also issue a signing secret every request must then be signed with. */
  signed: boolean;
}

/** A write to one routine, settled by reading the bot's list again. */
function useRoutineWrite<TVariables extends BotRoutineVariables, TData = void>(
  write: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    ...withCacheOnSuccess(options, (_data, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botsKeys.routines(id) }),
        queryClient.invalidateQueries({ queryKey: botsKeys.allRoutines() }),
      ]),
    ),
  });
}

/** The Routines tab's switch. */
export function useSetBotRoutineEnabled(
  options?: UseMutationOptions<void, Error, SetBotRoutineEnabledVariables>,
) {
  const app = useConsumerApp();
  return useRoutineWrite(
    ({ id, routineId, enabled }: SetBotRoutineEnabledVariables) =>
      app.bots.setRoutineEnabled(id, routineId, enabled),
    options,
  );
}

/** Run now: the routine reads running, and the list polls until its turn ends. */
export function useRunBotRoutine(
  options?: UseMutationOptions<void, Error, RunBotRoutineVariables>,
) {
  const app = useConsumerApp();
  return useRoutineWrite(
    ({ id, routineId, idempotencyKey }: RunBotRoutineVariables) =>
      app.bots.runRoutine(id, routineId, idempotencyKey),
    options,
  );
}

/**
 * A new webhook URL for a routine, replacing its old one. The URL and secret
 * are in the mutation's result alone: the list never carries them.
 */
export function useIssueBotRoutineWebhook(
  options?: UseMutationOptions<IssuedBotRoutineWebhook, Error, IssueBotRoutineWebhookVariables>,
) {
  const app = useConsumerApp();
  return useRoutineWrite(
    ({ id, routineId, signed }: IssueBotRoutineWebhookVariables) =>
      app.bots.issueRoutineWebhook(id, routineId, signed),
    options,
  );
}

export function useRevokeBotRoutineWebhook(
  options?: UseMutationOptions<void, Error, BotRoutineVariables>,
) {
  const app = useConsumerApp();
  return useRoutineWrite(
    ({ id, routineId }: BotRoutineVariables) => app.bots.revokeRoutineWebhook(id, routineId),
    options,
  );
}

export function useDeleteBotRoutine(
  options?: UseMutationOptions<void, Error, BotRoutineVariables>,
) {
  const app = useConsumerApp();
  return useRoutineWrite(
    ({ id, routineId }: BotRoutineVariables) => app.bots.deleteRoutine(id, routineId),
    options,
  );
}
