import {
  BOT_PROVIDER_CATALOG,
  type BotAvatarColor,
  type BotPermission,
  type BotProvider,
  botEffortLevelFor,
  botModelOf,
  type CreateBotDto,
  type UpdateBotDto,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotEntity } from '../bots/domain/bot.entity';
import { permissionForBotMadeBy } from '../bots/domain/bot-creation.policy';
import type { BotGroupEntity } from '../bots/domain/bot-group.entity';

/**
 * How `create_bot`'s input becomes a bot to create (`25-bots.md` §4.6), one
 * resolve-or-refuse step at a time: the provider (the one named, else the
 * creator's) and only one the workspace has a key for; the model (the one
 * named, by id or label, else the creator's on the same provider, else the
 * provider's default); the effort; the level, never looser than the
 * creator's; and the group, one of the owner's, by id or name. A refusal is
 * the sentence that tells the model what to ask or fix. Pure.
 */
export interface CreateBotInput {
  name: string;
  description?: string;
  soul?: string;
  instructions?: string;
  provider?: BotProvider;
  /** Left out: the creator's, or the provider's default. `null`: the provider's default. */
  model?: string | null;
  /** Left out: the creator's on the same model. `null`: the model's own default. */
  effort?: SessionEffort | null;
  permission?: BotPermission;
  group?: string;
}

export interface BotCreationPlan {
  /** What the console's form would send. */
  body: CreateBotDto;
  model: string | null;
  effort: SessionEffort | null;
  permission: BotPermission;
  soul?: string;
  instructions?: string;
  /** The group's name as the owner sees it; null for ungrouped. */
  groupName: string | null;
}

/** What each level is called on the composer's approval chip. */
export const BOT_PERMISSION_LABELS: Readonly<Record<BotPermission, string>> = {
  auto: 'Approve for me',
  full: 'Full access',
};

type Resolved<T> = { value: T } | { refusal: string };

export function planBotCreation(
  input: CreateBotInput,
  creator: BotEntity,
  keyedProviders: readonly BotProvider[],
  groups: readonly BotGroupEntity[],
): BotCreationPlan | { refusal: string } {
  const provider = resolveProvider(input, creator, keyedProviders);
  if ('refusal' in provider) return provider;
  const model = resolveModel(input, creator, provider.value);
  if ('refusal' in model) return model;
  const effort = resolveEffort(input, creator, provider.value, model.value);
  if ('refusal' in effort) return effort;
  const permission = resolvePermission(input, creator);
  if ('refusal' in permission) return permission;
  const group = resolveGroup(input, groups);
  if ('refusal' in group) return group;
  return {
    body: {
      name: input.name,
      description: input.description,
      groupId: group.value?.id ?? null,
      provider: provider.value,
    },
    model: model.value,
    effort: effort.value,
    permission: permission.value,
    soul: input.soul,
    instructions: input.instructions,
    groupName: group.value?.name ?? null,
  };
}

/**
 * The call with every default the plan resolved written out: the provider,
 * model, effort, level and the group by id. What an approval stores, so the
 * bot made on a yes is the one its card showed, whatever the creator's
 * engine has become since.
 */
export function explicitCreateBotInput(
  input: CreateBotInput,
  plan: BotCreationPlan,
): CreateBotInput {
  const { group: _named, ...rest } = input;
  return {
    ...rest,
    provider: plan.body.provider,
    model: plan.model,
    effort: plan.effort,
    permission: plan.permission,
    ...(plan.body.groupId ? { group: plan.body.groupId } : {}),
  };
}

function resolveProvider(
  input: CreateBotInput,
  creator: BotEntity,
  keyed: readonly BotProvider[],
): Resolved<BotProvider> {
  const provider = input.provider ?? creator.provider;
  if (keyed.includes(provider)) return { value: provider };
  const label = BOT_PROVIDER_CATALOG[provider].label;
  if (keyed.length === 0) {
    return {
      refusal:
        'The workspace has no model provider key, so no new bot could answer. Ask the person to add one in Settings → Model providers.',
    };
  }
  const usable = keyed.map((id) => `${id} (${BOT_PROVIDER_CATALOG[id].label})`).join(', ');
  return {
    refusal: `The workspace has no ${label} key, so a bot on ${label} could not answer. Providers it can use: ${usable}. Pick one of those, or ask the person to add a ${label} key in Settings → Model providers.`,
  };
}

function resolveModel(
  input: CreateBotInput,
  creator: BotEntity,
  provider: BotProvider,
): Resolved<string | null> {
  if (input.model === undefined) {
    return { value: provider === creator.provider ? creator.model : null };
  }
  if (input.model === null) return { value: null };
  const wanted = input.model.trim().toLowerCase();
  const row = BOT_PROVIDER_CATALOG[provider].models.find(
    (candidate) =>
      candidate.id.toLowerCase() === wanted || candidate.label.toLowerCase() === wanted,
  );
  if (row) return { value: row.id };
  const offered = BOT_PROVIDER_CATALOG[provider].models.map((candidate) => candidate.id).join(', ');
  return {
    refusal: `${BOT_PROVIDER_CATALOG[provider].label} has no model "${input.model}". Its models: ${offered}. Leave model out for ${engineLabelOf(provider, null)}.`,
  };
}

function resolveEffort(
  input: CreateBotInput,
  creator: BotEntity,
  provider: BotProvider,
  model: string | null,
): Resolved<SessionEffort | null> {
  const inherited = provider === creator.provider && model === creator.model;
  const requested = input.effort !== undefined ? input.effort : inherited ? creator.effort : null;
  const effort = botEffortLevelFor(provider, model, requested);
  if (!input.effort || effort !== null) return { value: effort };
  const levels = botModelOf(provider, model)?.effort?.levels ?? [];
  return {
    refusal: `${engineLabelOf(provider, model)} does not take effort "${input.effort}". ${
      levels.length ? `It takes: ${levels.join(', ')}.` : 'It takes no effort level.'
    } Leave effort out for its default.`,
  };
}

function resolvePermission(input: CreateBotInput, creator: BotEntity): Resolved<BotPermission> {
  const level = permissionForBotMadeBy(creator.permission, input.permission);
  if (!('refused' in level)) return { value: level.permission };
  const ceiling = BOT_PERMISSION_LABELS[level.ceiling];
  return {
    refusal: `You run under ${ceiling}, and a bot you create can have no looser permissions than yours. Leave permission out (it gets ${ceiling}); the person can raise it in the new bot's settings.`,
  };
}

function resolveGroup(
  input: CreateBotInput,
  groups: readonly BotGroupEntity[],
): Resolved<BotGroupEntity | null> {
  if (!input.group) return { value: null };
  const named = input.group.trim();
  const group =
    groups.find((candidate) => candidate.id === named) ??
    groups.find((candidate) => candidate.name.toLowerCase() === named.toLowerCase());
  if (group) return { value: group };
  const names = groups.map((candidate) => `"${candidate.name}"`).join(', ');
  return {
    refusal: `The workspace has no bot group "${input.group}". ${
      names ? `Its groups: ${names}.` : 'It has no groups.'
    } Leave group out to create it ungrouped; you cannot create groups.`,
  };
}

/** How much of the description a Needs input card shows. */
const DESCRIPTION_IN_SUMMARY_MAX = 160;

/**
 * The Needs input card's line: `Create bot "Scout" on GLM GLM-5.3, in group
 * Research: Finds papers`, the description cut to fit, and left out when
 * there is none.
 */
export function botCreationSummary(name: string, plan: BotCreationPlan): string {
  const provider = plan.body.provider ?? 'anthropic';
  const group = plan.groupName ? `, in group ${plan.groupName}` : '';
  const description = (plan.body.description ?? '').replace(/\s+/g, ' ').trim();
  const clipped =
    description.length > DESCRIPTION_IN_SUMMARY_MAX
      ? `${description.slice(0, DESCRIPTION_IN_SUMMARY_MAX - 1)}…`
      : description;
  return `Create bot "${name}" on ${engineLabelOf(provider, plan.model)}${group}${clipped ? `: ${clipped}` : ''}`;
}

/** What the tool answers once the bot exists. */
export function botCreatedAnswer(bot: BotEntity, groupName: string | null): string {
  const group = groupName ? `, in group ${groupName}` : '';
  return [
    `Created bot ${bot.id} "${bot.name}"${group}.`,
    `- runs on: ${engineLabelOf(bot.provider, bot.model)} (provider ${bot.provider}, model ${bot.model ?? 'default'})`,
    `- permission: ${BOT_PERMISSION_LABELS[bot.permission]} (${bot.permission})`,
    "It is the person's bot, marked as created by you. They can open it from the sidebar, under Employees.",
  ].join('\n');
}

/**
 * "GLM GLM-5.3": the provider's label and the model's, the default's when
 * none is named. The one way the bot tools name what runs a bot.
 */
export function engineLabelOf(provider: BotProvider, model: string | null): string {
  const row = botModelOf(provider, model);
  return `${BOT_PROVIDER_CATALOG[provider].label} ${row?.label ?? model ?? 'default model'}`;
}

/**
 * `update_bot`'s input (`25-bots.md` §4.6): the bots to change, by id, and
 * what to change on each. A field left out stays as it is.
 */
export interface UpdateBotsInput {
  bot_ids: string[];
  name?: string;
  description?: string;
  avatar_color?: BotAvatarColor;
  provider?: BotProvider;
  /** `null`: the provider's default. */
  model?: string | null;
  /** `null`: the model's own default. */
  effort?: SessionEffort | null;
  permission?: BotPermission;
  /** A group by id or name; `null` takes them out of their group. */
  group?: string | null;
  learn_automatically?: boolean;
}

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
      refusal:
        'Name at least one thing to change: name, description, avatar_color, provider, model, effort, permission, group or learn_automatically.',
    };
  }
  if (input.name !== undefined && bots.length > 1) {
    return { refusal: 'A name goes to one bot at a time: call update_bot once per bot to rename.' };
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
        refusal: `You run under ${ceiling}, and you cannot give a bot looser permissions than yours. Ask the person to raise it in that bot's settings.`,
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
      body: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.avatar_color !== undefined ? { avatarColor: input.avatar_color } : {}),
        ...engine.value,
        ...(permission !== undefined ? { permission } : {}),
        ...(groupId !== undefined ? { groupId } : {}),
        ...(input.learn_automatically !== undefined
          ? { learnAutomatically: input.learn_automatically }
          : {}),
      },
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
        refusal: `For "${bot.name}": ${engineLabelOf(provider, model)} does not take effort "${input.effort}". ${
          levels.length ? `It takes: ${levels.join(', ')}.` : 'It takes no effort level.'
        } Leave effort out for its default.`,
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
export function botsUpdatedAnswer(bots: readonly BotEntity[]): string {
  return [
    `Updated ${bots.length === 1 ? '1 bot' : `${bots.length} bots`}:`,
    ...bots.map(
      (bot) =>
        `- ${bot.id} "${bot.name}": runs on ${engineLabelOf(bot.provider, bot.model)} (provider ${bot.provider}, model ${bot.model ?? 'default'}, effort ${bot.effort ?? 'default'}); permission ${BOT_PERMISSION_LABELS[bot.permission]}`,
    ),
  ].join('\n');
}
