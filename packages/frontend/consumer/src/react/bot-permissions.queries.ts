'use client';

import { useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { BotPermissionRuleEffect, BotToolDecision } from '@oppenheimer/shared/schemas/bot';
import type { BotPermissionsEntity } from '../modules/bots/bot-permissions.entity';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

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

export const useSetBotToolDecision = mutation<BotPermissionsEntity, SetBotToolDecisionVariables>({
  run: (app, { id, tool, decision }) => app.bots.setToolDecision(id, tool, decision),
  update: (queryClient, view, { id }) => queryClient.setQueryData(botsKeys.permissions(id), view),
});

export interface AddBotPermissionRuleVariables {
  id: string;
  effect: BotPermissionRuleEffect;
  text: string;
}

export const useAddBotPermissionRule = mutation<
  BotPermissionsEntity,
  AddBotPermissionRuleVariables
>({
  run: (app, { id, effect, text }) => app.bots.addPermissionRule(id, effect, text),
  update: (queryClient, view, { id }) => queryClient.setQueryData(botsKeys.permissions(id), view),
});

export interface DeleteBotPermissionRuleVariables {
  id: string;
  ruleId: string;
}

export const useDeleteBotPermissionRule = mutation<void, DeleteBotPermissionRuleVariables>({
  run: (app, { id, ruleId }) => app.bots.removePermissionRule(id, ruleId),
  update: (queryClient, _data, { id }) =>
    queryClient.invalidateQueries({ queryKey: botsKeys.permissions(id) }),
});

export interface DeleteBotToolGrantVariables {
  id: string;
  grantId: string;
}

export const useDeleteBotToolGrant = mutation<void, DeleteBotToolGrantVariables>({
  run: (app, { id, grantId }) => app.bots.removeToolGrant(id, grantId),
  update: (queryClient, _data, { id }) =>
    queryClient.invalidateQueries({ queryKey: botsKeys.permissions(id) }),
});
