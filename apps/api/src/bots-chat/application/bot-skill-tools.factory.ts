import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  BOT_SKILL_BODY_MAX,
  BOT_SKILL_DESCRIPTION_MAX,
  BOT_SKILL_NAME_MAX,
  BOT_SKILL_NAME_PATTERN,
  BOT_SKILLS_MAX,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { CreateBotSkillCommand } from '../../bots/commands/create-bot-skill/create-bot-skill.command';
import { DeleteBotSkillCommand } from '../../bots/commands/delete-bot-skill/delete-bot-skill.command';
import { UpdateBotSkillCommand } from '../../bots/commands/update-bot-skill/update-bot-skill.command';
import type { BotSkillEntity } from '../../bots/domain/bot-skill.entity';
import { FindBotSkillQuery } from '../../bots/queries/find-bot-skill/find-bot-skill.query';
import { FindBotSkillsQuery } from '../../bots/queries/find-bot-skills/find-bot-skills.query';
import {
  type BotBuiltInSkill,
  describeSkillUse,
  isBuiltInSkill,
  skillBlock,
  withBuiltInSkills,
} from '../domain/bot-skill.policy';
import {
  isOppenheimersSkillName,
  oppenheimersSkillRefusal,
  patchSkillBody,
  skillAuthorNote,
  skillChangeAllowed,
  skillPatchRefusal,
  theirSkillRefusal,
} from '../domain/bot-skill-learning.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const skillName = z
  .string()
  .trim()
  .max(BOT_SKILL_NAME_MAX)
  .regex(BOT_SKILL_NAME_PATTERN)
  .describe('The skill\'s name, as the skills list or /<name> shows it, e.g. "release-notes".');

/**
 * Its skills (`25-bots.md` §4.1, from OpenClaw's skills and Grok Bot's saved
 * skills): the bot reads one when a request fits it, saves the way it did a
 * task as one when the person asks or the work was hard and will come again,
 * and fixes one that turned out wrong (Hermes Agent's learning loop). Every
 * tool acts on the turn's bot, its id the context's and never an input.
 * Listed under Itself in Settings →
 * Permissions, beside its documents and memory.
 */
@Injectable()
export class BotSkillToolsFactory implements BotToolArea {
  readonly group = 'self' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.useSkill(), this.saveSkill(), this.patchSkill(), this.deleteSkill()];
  }

  private useSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'use_skill',
      readOnly: true,
      scope: 'bots:read',
      description:
        'Reads one of your skills in full, by name, so you can follow it. Use it before starting a request that one of your skills (listed under "Your skills") covers, then follow its steps. A skill only the person may run (by typing /<name>) is not yours to use unasked.',
      input: z.strictObject({ name: skillName }),
      run: async (input, context) => {
        const skill = await this.skillToUse(context, input.name);
        if (!skill.modelInvocable) {
          return `Not read: "${skill.name}" is a skill only the person runs, by typing /${skill.name}. Tell them it fits, if it does.`;
        }
        const read = `${describeSkillUse(skill)}\n\n${skillBlock(skill)}`;
        // Oppenheimer's own skills are product text: nothing for the bot to fix.
        return isBuiltInSkill(skill) ? read : `${read}\n\n${skillAuthorNote(skill.source)}`;
      },
    });
  }

  private saveSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'save_skill',
      scope: 'bots:write',
      description: `Saves a skill: a reusable way of doing one task, under a short name the person can run as /<name>. Use it when the person asks you to save how you did something ("save that as a skill called…"), or on your own after a task that took real work (several tool calls, or a dead end you worked around) and is likely to come up again, which the person saying they do it regularly is reason enough for: never for a one-off, a lookup of a call or two, or anything holding a secret or the person's private data; at most one new skill a turn, and say in your answer that you saved it, by name. A skill of yours with that name is replaced: one the person wrote last only when they asked (set asked_by_person), and to fix one step use patch_skill rather than resending the whole body. The names of the skills Oppenheimer gives every bot are taken. The body says when it applies, what it needs, the steps, how to check the result and what to report, and what needs the person's OK. Name 1 to ${BOT_SKILL_NAME_MAX} of a-z, 0-9 and -; description at most ${BOT_SKILL_DESCRIPTION_MAX}; body at most ${BOT_SKILL_BODY_MAX}; at most ${BOT_SKILLS_MAX} skills. The person sees and edits it in Settings → Skills.`,
      input: z.strictObject({
        name: skillName,
        description: z
          .string()
          .trim()
          .min(1)
          .max(BOT_SKILL_DESCRIPTION_MAX)
          .describe('One sentence on what it does and when to use it.'),
        body: z
          .string()
          .trim()
          .min(1)
          .max(BOT_SKILL_BODY_MAX)
          .describe('The skill, in Markdown: when, inputs, steps, checks, what to report.'),
        user_invocable: z
          .boolean()
          .optional()
          .describe('Whether the person may run it as /<name>. Default true.'),
        model_invocable: z
          .boolean()
          .optional()
          .describe(
            'Whether you may use it unasked when a request fits. Default true; false for a skill only the person should start.',
          ),
        asked_by_person: z
          .boolean()
          .optional()
          .describe(
            'True only when the person asked in this conversation to change this skill. Needed to replace a skill they wrote.',
          ),
      }),
      run: async (input, context) => {
        const change = {
          name: input.name,
          description: input.description,
          body: input.body,
          userInvocable: input.user_invocable,
          modelInvocable: input.model_invocable,
        };
        const existing = (await this.skills(context)).find((skill) => skill.name === input.name);
        if (isOppenheimersSkillName(input.name, existing !== undefined)) {
          throw new BotToolRefusal(oppenheimersSkillRefusal(input.name, 'saved'));
        }
        if (
          existing &&
          !skillChangeAllowed({
            source: existing.source,
            askedByPerson: input.asked_by_person === true,
          })
        ) {
          throw new BotToolRefusal(theirSkillRefusal(existing.name, 'saved'));
        }
        if (existing) {
          await this.commandBus.execute(
            new UpdateBotSkillCommand({
              scope: context.owner,
              botId: context.botId,
              skillId: existing.id,
              change,
              author: 'bot',
            }),
          );
        } else {
          await this.commandBus.execute(
            new CreateBotSkillCommand({
              scope: context.owner,
              botId: context.botId,
              ...change,
              author: 'bot',
            }),
          );
        }
        const saved = await this.skill(context, input.name);
        const runs = [
          saved.userInvocable ? `the person runs it as /${saved.name}` : null,
          saved.modelInvocable ? 'you use it when a request fits' : null,
        ].filter(Boolean);
        return `${existing ? 'Updated' : 'Saved'} skill "${saved.name}" (${runs.join('; ')}). The person can see and edit it in Settings → Skills.`;
      },
    });
  }

  private patchSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'patch_skill',
      scope: 'bots:write',
      description: `Fixes part of one of your skills: replaces one exact passage of its body with new text, so a step that turned out wrong or out of date is fixed without resending the whole skill. Use it once the task is done, when a skill you followed was wrong or stale, and say in your answer what you fixed. old_text must occur exactly once in the body, copied as use_skill showed it; the result is at most ${BOT_SKILL_BODY_MAX} characters. A skill you saved last you may fix unasked; one the person wrote last only when they asked for the change in this conversation (set asked_by_person), otherwise propose the change in your answer. The skills Oppenheimer gives every bot cannot be changed.`,
      input: z.strictObject({
        name: skillName,
        old_text: z
          .string()
          .min(1)
          .max(BOT_SKILL_BODY_MAX)
          .describe('The passage to replace, exactly as it is in the skill, enough to be unique.'),
        new_text: z
          .string()
          .max(BOT_SKILL_BODY_MAX)
          .describe('What replaces it; empty removes the passage.'),
        asked_by_person: z
          .boolean()
          .optional()
          .describe(
            'True only when the person asked for this change in this conversation. Needed to change a skill they wrote.',
          ),
      }),
      run: async (input, context) => {
        const own = (await this.skills(context)).find((skill) => skill.name === input.name);
        if (isOppenheimersSkillName(input.name, own !== undefined)) {
          throw new BotToolRefusal(oppenheimersSkillRefusal(input.name, 'changed'));
        }
        const skill = own ?? (await this.skill(context, input.name));
        const askedByPerson = input.asked_by_person === true;
        if (!skillChangeAllowed({ source: skill.source, askedByPerson })) {
          throw new BotToolRefusal(theirSkillRefusal(skill.name, 'changed'));
        }
        const patch = patchSkillBody(skill.body, input.old_text, input.new_text);
        if (!patch.ok) throw new BotToolRefusal(skillPatchRefusal(skill.name, patch.reason));
        await this.commandBus.execute(
          new UpdateBotSkillCommand({
            scope: context.owner,
            botId: context.botId,
            skillId: skill.id,
            change: { body: patch.body },
            author: 'bot',
          }),
        );
        return `Fixed skill "${skill.name}". Say in your answer what you changed. The person can see and edit it in Settings → Skills.`;
      },
    });
  }

  private deleteSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'delete_skill',
      scope: 'bots:write',
      description:
        'Deletes one of your skills, by name, and its /<name> command with it. It cannot be undone; only when the person asks.',
      input: z.strictObject({ name: skillName }),
      run: async (input, context) => {
        const skill = await this.skill(context, input.name);
        await this.commandBus.execute(
          new DeleteBotSkillCommand({
            scope: context.owner,
            botId: context.botId,
            skillId: skill.id,
          }),
        );
        const left = await this.skills(context);
        return `Deleted skill "${skill.name}"; you have ${left.length} left.`;
      },
    });
  }

  /** Every skill of the bot's, at most `BOT_SKILLS_MAX`: what "is there one by that name" reads. */
  private skills(context: BotToolCallContext): Promise<BotSkillEntity[]> {
    return this.queryBus.execute<FindBotSkillsQuery, BotSkillEntity[]>(
      new FindBotSkillsQuery({ scope: context.owner, botId: context.botId }),
    );
  }

  /**
   * The skill `use_skill` reads: the one that name means among every skill
   * the bot has (`withBuiltInSkills`), else the own skill's not-found.
   */
  private async skillToUse(
    context: BotToolCallContext,
    name: string,
  ): Promise<BotSkillEntity | BotBuiltInSkill> {
    const found = withBuiltInSkills(await this.skills(context)).find(
      (skill) => skill.name === name,
    );
    return found ?? this.skill(context, name);
  }

  private skill(context: BotToolCallContext, name: string): Promise<BotSkillEntity> {
    return this.queryBus.execute<FindBotSkillQuery, BotSkillEntity>(
      new FindBotSkillQuery({ scope: context.owner, botId: context.botId, skill: { name } }),
    );
  }
}
