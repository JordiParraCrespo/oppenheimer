import {
  BOT_PROVIDER_CATALOG,
  type BotPermission,
  type BotProvider,
  botEffortLevelFor,
  botModelOf,
  type CreateBotDto,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { BotEntity } from '../bots/domain/bot.entity';
import { permissionForBotMadeBy } from '../bots/domain/bot-creation.policy';
import type { BotGroupEntity } from '../bots/domain/bot-group.entity';

/**
 * How `create_bot`'s input becomes a bot to create (`25-bots.md` §4.6): the
 * provider (the one named, else the creator's) and only one the workspace
 * has a key for; the model (the one named, by id or label, else the
 * creator's on the same provider, else the provider's default); the effort;
 * the level, never looser than the creator's; and the group, one of the
 * owner's, by id or name. Or, when one is wrong, the sentence that tells the
 * model what to ask or fix. Pure.
 */
export interface CreateBotInput {
  name: string;
  description?: string;
  soul?: string;
  instructions?: string;
  provider?: BotProvider;
  model?: string;
  effort?: SessionEffort;
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

export function planBotCreation(
  input: CreateBotInput,
  creator: BotEntity,
  keyedProviders: readonly BotProvider[],
  groups: readonly BotGroupEntity[],
): BotCreationPlan | { refusal: string } {
  const provider = input.provider ?? creator.provider;
  if (!keyedProviders.includes(provider))
    return { refusal: keylessRefusal(provider, keyedProviders) };

  const model = input.model
    ? modelIdOf(provider, input.model)
    : provider === creator.provider
      ? creator.model
      : null;
  if (model === undefined) {
    const offered = BOT_PROVIDER_CATALOG[provider].models.map((row) => row.id).join(', ');
    return {
      refusal: `${BOT_PROVIDER_CATALOG[provider].label} has no model "${input.model}". Its models: ${offered}. Leave model out for ${labelOf(provider, null)}.`,
    };
  }

  const inherited = provider === creator.provider && model === creator.model;
  const effort = botEffortLevelFor(
    provider,
    model,
    input.effort ?? (inherited ? creator.effort : null),
  );
  if (input.effort && effort === null) {
    const levels = botModelOf(provider, model)?.effort?.levels ?? [];
    return {
      refusal: `${labelOf(provider, model)} does not take effort "${input.effort}". ${
        levels.length ? `It takes: ${levels.join(', ')}.` : 'It takes no effort level.'
      } Leave effort out for its default.`,
    };
  }

  const level = permissionForBotMadeBy(creator.permission, input.permission);
  if ('refused' in level) {
    return {
      refusal: `You run under ${BOT_PERMISSION_LABELS[level.ceiling]}, and a bot you create can have no looser permissions than yours. Leave permission out (it gets ${BOT_PERMISSION_LABELS[level.ceiling]}); the person can raise it in the new bot's settings.`,
    };
  }

  const group = input.group ? groupOf(groups, input.group) : null;
  if (group === undefined) {
    const names = groups.map((row) => `"${row.name}"`).join(', ');
    return {
      refusal: `The workspace has no bot group "${input.group}". ${
        names ? `Its groups: ${names}.` : 'It has no groups.'
      } Leave group out to create it ungrouped; you cannot create groups.`,
    };
  }

  return {
    body: {
      name: input.name,
      description: input.description,
      groupId: group?.id ?? null,
      provider,
    },
    model,
    effort,
    permission: level.permission,
    soul: input.soul,
    instructions: input.instructions,
    groupName: group?.name ?? null,
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
  return `Create bot "${name}" on ${labelOf(provider, plan.model)}${group}${clipped ? `: ${clipped}` : ''}`;
}

/** What the tool answers once the bot exists. */
export function botCreatedAnswer(bot: BotEntity, groupName: string | null): string {
  const group = groupName ? `, in group ${groupName}` : '';
  return [
    `Created bot ${bot.id} "${bot.name}"${group}.`,
    `- runs on: ${labelOf(bot.provider, bot.model)} (provider ${bot.provider}, model ${bot.model ?? 'default'})`,
    `- permission: ${BOT_PERMISSION_LABELS[bot.permission]} (${bot.permission})`,
    "It is the person's bot, marked as created by you. They can open it from the sidebar, under Employees.",
  ].join('\n');
}

/** "GLM GLM-5.3": the provider's label and the model's, the default's when none is named. */
export function labelOf(provider: BotProvider, model: string | null): string {
  const row = botModelOf(provider, model);
  return `${BOT_PROVIDER_CATALOG[provider].label} ${row?.label ?? model ?? 'default model'}`;
}

/** The catalog id for a model named by id or label, whatever its case; undefined when the provider has none. */
function modelIdOf(provider: BotProvider, named: string): string | undefined {
  const wanted = named.trim().toLowerCase();
  return BOT_PROVIDER_CATALOG[provider].models.find(
    (row) => row.id.toLowerCase() === wanted || row.label.toLowerCase() === wanted,
  )?.id;
}

function groupOf(groups: readonly BotGroupEntity[], named: string): BotGroupEntity | undefined {
  const wanted = named.trim().toLowerCase();
  return (
    groups.find((group) => group.id === named.trim()) ??
    groups.find((group) => group.name.toLowerCase() === wanted)
  );
}

function keylessRefusal(provider: BotProvider, keyed: readonly BotProvider[]): string {
  const label = BOT_PROVIDER_CATALOG[provider].label;
  if (keyed.length === 0) {
    return `The workspace has no model provider key, so no new bot could answer. Ask the person to add one in Settings → Model providers.`;
  }
  const usable = keyed.map((id) => `${id} (${BOT_PROVIDER_CATALOG[id].label})`).join(', ');
  return `The workspace has no ${label} key, so a bot on ${label} could not answer. Providers it can use: ${usable}. Pick one of those, or ask the person to add a ${label} key in Settings → Model providers.`;
}
