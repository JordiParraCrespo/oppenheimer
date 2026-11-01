'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BotSkillEntity,
  CreateBotSkillInput,
  UpdateBotSkillInput,
} from '../modules/bots/bot.entity';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';

/**
 * A bot's skills (`25-bots.md` §4.1): Settings → Skills and the composer's
 * `/` menu read one list, under the bot's detail key so deleting the bot drops
 * it. Every write settles by reading the list again: a rename reorders it, and
 * the bot may have saved one of its own since it was read.
 */

/** A bot's skills by name, under a Suspense `QueryState`. */
export function useSuspenseBotSkills(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotSkillEntity[], Error>({
    queryKey: botsKeys.skillList(id),
    queryFn: () => app.bots.findSkills(id),
  });
}

/**
 * The skills the person may run, for the composer's `/` menu: it draws
 * nothing while they load or when the read fails, so it is no `QueryState`
 * site, and it is read only while the menu is open.
 */
export function useBotSlashCommands(id: string, enabled: boolean) {
  const app = useConsumerApp();
  return useQuery<BotSkillEntity[], Error, BotSkillEntity[]>({
    queryKey: botsKeys.skillList(id),
    queryFn: () => app.bots.findSkills(id),
    enabled,
    select: (rows) => rows.filter((skill) => skill.userInvocable),
  });
}

export interface AddBotSkillVariables extends CreateBotSkillInput {
  id: string;
}

export interface UpdateBotSkillVariables extends UpdateBotSkillInput {
  id: string;
  skillId: string;
}

export interface DeleteBotSkillVariables {
  id: string;
  skillId: string;
}

/** A write to a bot's skills, settled by reading its list again. */
function useSkillWrite<TData, TVariables extends { id: string }>(
  write: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    ...withCacheOnSuccess(options, (_data, { id }) =>
      queryClient.invalidateQueries({ queryKey: botsKeys.skills(id) }),
    ),
  });
}

export function useAddBotSkill(
  options?: UseMutationOptions<BotSkillEntity, Error, AddBotSkillVariables>,
) {
  const app = useConsumerApp();
  return useSkillWrite(
    ({ id, ...skill }: AddBotSkillVariables) => app.bots.addSkill(id, skill),
    options,
  );
}

export function useUpdateBotSkill(
  options?: UseMutationOptions<BotSkillEntity, Error, UpdateBotSkillVariables>,
) {
  const app = useConsumerApp();
  return useSkillWrite(
    ({ id, skillId, ...change }: UpdateBotSkillVariables) =>
      app.bots.updateSkill(id, skillId, change),
    options,
  );
}

export function useDeleteBotSkill(
  options?: UseMutationOptions<void, Error, DeleteBotSkillVariables>,
) {
  const app = useConsumerApp();
  return useSkillWrite(
    ({ id, skillId }: DeleteBotSkillVariables) => app.bots.removeSkill(id, skillId),
    options,
  );
}
