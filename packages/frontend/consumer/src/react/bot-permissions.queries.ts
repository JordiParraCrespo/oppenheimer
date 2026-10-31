'use client';

import { useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import type { BotPermissionRuleEffect, BotToolDecision } from '@oppenheimer/shared/schemas/bot';
import { type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotPermissionsEntity } from '../modules/bots/bot-permissions.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';

/**
 * A bot's Settings → Permissions (`product/versions/mvp/25-bots.md` §5):
 * every tool's Allow, Ask or Off, the standing grants a yes left, and the
 * plain-language rules. A write answers the whole view, which replaces the
 * cached one; a delete answers nothing, so the view is read again.
 */
export function useSuspenseBotPermissions(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotPermissionsEntity, Error>({
    queryKey: botsKeys.permissions(id),
    queryFn: () => app.bots.findPermissions(id),
  });
}

export interface SetBotToolDecisionVariables {
  id: string;
  tool: string;
  decision: BotToolDecision | 'default';
}

export function useSetBotToolDecision(
  options?: UseMutationOptions<BotPermissionsEntity, Error, SetBotToolDecisionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tool, decision }: SetBotToolDecisionVariables) =>
      app.bots.setToolDecision(id, tool, decision),
    ...withCacheOnSuccess(options, (view, { id }) =>
      queryClient.setQueryData(botsKeys.permissions(id), view),
    ),
  });
}

export interface AddBotPermissionRuleVariables {
  id: string;
  effect: BotPermissionRuleEffect;
  text: string;
}

export function useAddBotPermissionRule(
  options?: UseMutationOptions<BotPermissionsEntity, Error, AddBotPermissionRuleVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, effect, text }: AddBotPermissionRuleVariables) =>
      app.bots.addPermissionRule(id, effect, text),
    ...withCacheOnSuccess(options, (view, { id }) =>
      queryClient.setQueryData(botsKeys.permissions(id), view),
    ),
  });
}

export interface DeleteBotPermissionRuleVariables {
  id: string;
  ruleId: string;
}

export function useDeleteBotPermissionRule(
  options?: UseMutationOptions<void, Error, DeleteBotPermissionRuleVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ruleId }: DeleteBotPermissionRuleVariables) =>
      app.bots.removePermissionRule(id, ruleId),
    ...withCacheOnSuccess(options, (_data, { id }) =>
      queryClient.invalidateQueries({ queryKey: botsKeys.permissions(id) }),
    ),
  });
}

export interface DeleteBotToolGrantVariables {
  id: string;
  grantId: string;
}

export function useDeleteBotToolGrant(
  options?: UseMutationOptions<void, Error, DeleteBotToolGrantVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grantId }: DeleteBotToolGrantVariables) =>
      app.bots.removeToolGrant(id, grantId),
    ...withCacheOnSuccess(options, (_data, { id }) =>
      queryClient.invalidateQueries({ queryKey: botsKeys.permissions(id) }),
    ),
  });
}
