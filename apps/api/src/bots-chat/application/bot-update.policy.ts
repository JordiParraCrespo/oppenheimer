import {
  type BotPermission,
  type BotProvider,
  botEffortLevelFor,
  botModelOf,
  type UpdateBotDto,
} from '@oppenheimer/shared';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { permissionForBotMadeBy } from '../../bots/domain/bot-creation.policy';
import type { BotGroupEntity } from '../../bots/domain/bot-group.entity';
import {
  BOT_PERMISSION_LABELS,
  engineLabelOf,
  type Resolved,
  resolveGroup,
  resolveModel,
  resolveProvider,
  toUpdateBotBody,
  type UpdateBotsInput,
} from '../bot-peer-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';

export type { UpdateBotsInput };

/** One bot's change: what the console's settings would send for it. */
export interface BotUpdateStep {
  bot: BotEntity;
  body: UpdateBotDto;
}

export interface BotUpdatePlan {
  steps: BotUpdateStep[];
  /** The group's name as the owner sees it, when one is set; null when they leave their group. */
  groupName?: string | null;
}

/**
 * How `update_bot`'s input becomes one change per bot, refused whole when
 * any bot's would be: a provider the workspace has a key for, a model that
 * provider offers (each bot's own provider when none is named), an effort
 * the resulting model takes, a level no looser than the caller's, and a
 * group of the owner's. A name goes to one bot at a time. Pure.
 */
export function planBotUpdate(
  input: UpdateBotsInput,
  caller: BotEntity,
  bots: readonly BotEntity[],
  keyedProviders: readonly BotProvider[],
  groups: readonly BotGroupEntity[],
): BotUpdatePlan | { refusal: string } {
  if (!hasUpdate(input)) {
    return {
      refusal: promptText('tools/bots.plan-bot-update-refusal-name-least-one'),
    };
  }
  if (input.name !== undefined && bots.length > 1) {
    return { refusal: promptText('tools/bots.plan-bot-update-refusal-name-goes-one') };
  }
  if (input.provider !== undefined) {
    const provider = resolveProvider(
      { name: '', provider: input.provider },
      caller,
      keyedProviders,
    );
    if ('refusal' in provider) return provider;
  }
  let permission: BotPermission | undefined;
  if (input.permission !== undefined) {
    const level = permissionForBotMadeBy(caller.permission, input.permission);
    if ('refused' in level) {
      const ceiling = BOT_PERMISSION_LABELS[level.ceiling];
      return {
        refusal: promptText('tools/bots.update-looser-than-yours', { ceiling }),
      };
    }
    permission = level.permission;
  }
  let groupId: string | null | undefined;
  let groupName: string | null | undefined;
  if (input.group === null) {
    groupId = null;
    groupName = null;
  } else if (input.group !== undefined) {
    const group = resolveGroup({ name: '', group: input.group }, groups);
    if ('refusal' in group) return group;
    groupId = group.value?.id ?? null;
    groupName = group.value?.name ?? null;
  }

  const steps: BotUpdateStep[] = [];
  for (const bot of bots) {
    const engine = engineUpdateFor(input, bot);
    if ('refusal' in engine) return engine;
    steps.push({
      bot,
      body: toUpdateBotBody(input, engine.value, permission, groupId),
    });
  }
  return { steps, ...(groupName !== undefined ? { groupName } : {}) };
}

function hasUpdate(input: UpdateBotsInput): boolean {
  const { bot_ids: _bots, ...changes } = input;
  return Object.values(changes).some((value) => value !== undefined);
}

/** The provider, model and effort one bot ends up on, as `resolveBotEngine` will write them. */
function engineUpdateFor(
  input: UpdateBotsInput,
  bot: BotEntity,
): Resolved<Pick<UpdateBotDto, 'provider' | 'model' | 'effort'>> {
  if (input.provider === undefined && input.model === undefined && input.effort === undefined) {
    return { value: {} };
  }
  const provider = input.provider ?? bot.provider;
  const sameProvider = provider === bot.provider;
  let model: string | null;
  if (input.model === undefined) {
    model = sameProvider ? bot.model : null;
  } else {
    const resolved = resolveModel({ name: '', model: input.model }, bot, provider);
    if ('refusal' in resolved) {
      return { refusal: `For "${bot.name}": ${resolved.refusal}` };
    }
    model = resolved.value;
  }
  if (input.effort) {
    const effort = botEffortLevelFor(provider, model, input.effort);
    if (effort === null) {
      const levels = botModelOf(provider, model)?.effort?.levels ?? [];
      return {
        refusal: promptText('tools/bots.engine-update-for-refusal', {
          name: bot.name,
          engineLabel: engineLabelOf(provider, model),
          effort: input.effort,
          levelsCount: levels.length
            ? `It takes: ${levels.join(', ')}.`
            : 'It takes no effort level.',
        }),
      };
    }
  }
  return {
    value: {
      ...(input.provider !== undefined ? { provider } : {}),
      model,
      ...(input.effort !== undefined ? { effort: input.effort } : {}),
    },
  };
}

/**
 * The Needs input card's line: `Update 2 bots (Zengue Jewels, Coverd Web):
 * runs on ChatGPT GPT-6.1 Sol, permission Approve for me`.
 */
export function botUpdateSummary(input: UpdateBotsInput, plan: BotUpdatePlan): string {
  const names = plan.steps.map((step) => step.bot.name).join(', ');
  const who = plan.steps.length === 1 ? `bot "${names}"` : `${plan.steps.length} bots (${names})`;
  return `Update ${who}: ${describeChanges(input, plan).join(', ')}`;
}

function describeChanges(input: UpdateBotsInput, plan: BotUpdatePlan): string[] {
  const changes: string[] = [];
  if (input.name !== undefined) changes.push(`rename to "${input.name}"`);
  if (input.description !== undefined) changes.push('new description');
  if (input.avatar_color !== undefined) changes.push(`colour ${input.avatar_color}`);
  if (input.provider !== undefined || input.model !== undefined) {
    const engines = [
      ...new Set(
        plan.steps.map((step) =>
          engineLabelOf(step.body.provider ?? step.bot.provider, step.body.model ?? null),
        ),
      ),
    ];
    changes.push(`runs on ${engines.join(' / ')}`);
  }
  if (input.effort !== undefined) changes.push(`effort ${input.effort ?? 'default'}`);
  if (input.permission !== undefined) {
    changes.push(`permission ${BOT_PERMISSION_LABELS[input.permission]}`);
  }
  if (plan.groupName !== undefined) {
    changes.push(plan.groupName === null ? 'out of its group' : `group ${plan.groupName}`);
  }
  if (input.learn_automatically !== undefined) {
    changes.push(input.learn_automatically ? 'learns automatically' : 'asks before it learns');
  }
  return changes;
}

/** What the tool answers once every bot is changed: each bot as it now stands. */
/** A bot whose write failed after the plan passed, and why. */
export interface BotUpdateFailure {
  bot: BotEntity;
  reason: string;
}

/** What the tool answers: each bot changed, as it now stands, then each that was not. */
export function botsUpdatedAnswer(
  bots: readonly BotEntity[],
  failed: readonly BotUpdateFailure[] = [],
): string {
  const lines = bots.length
    ? [
        `Updated ${bots.length === 1 ? '1 bot' : `${bots.length} bots`}:`,
        ...bots.map((bot) =>
          promptText('tools/bots.bots-updated-answer', {
            id: bot.id,
            name: bot.name,
            engineLabel: engineLabelOf(bot.provider, bot.model),
            provider: bot.provider,
            model: bot.model ?? 'default',
            effort: bot.effort ?? 'default',
            permission: BOT_PERMISSION_LABELS[bot.permission],
          }),
        ),
      ]
    : [];
  if (failed.length) {
    lines.push(
      `Not updated (${failed.length}):`,
      ...failed.map(({ bot, reason }) => `- ${bot.id} "${bot.name}": ${reason}`),
    );
  }
  return lines.join('\n');
}
