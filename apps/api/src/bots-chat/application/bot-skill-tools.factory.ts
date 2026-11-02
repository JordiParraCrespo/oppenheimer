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
import { describeSkillUse, skillBlock } from '../domain/bot-skill.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
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
 * skills): the bot reads one when a request fits it, and saves the way it did
 * a task as one when the person asks. Every tool acts on the turn's bot, its
 * id the context's and never an input. Listed under Itself in Settings →
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
    return [this.useSkill(), this.saveSkill(), this.deleteSkill()];
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
        const skill = await this.skill(context, input.name);
        if (!skill.modelInvocable) {
          return `Not read: "${skill.name}" is a skill only the person runs, by typing /${skill.name}. Tell them it fits, if it does.`;
        }
        return `${describeSkillUse(skill)}\n\n${skillBlock(skill)}`;
      },
    });
  }

  private saveSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'save_skill',
      scope: 'bots:write',
      description: `Saves a skill: a reusable way of doing one task, under a short name the person can run as /<name>. Use it when the person asks you to save how you did something ("save that as a skill called…"), or to change one of yours. A skill with that name is replaced. The body says when it applies, what it needs, the steps, how to check the result and what to report, and what needs the person's OK. Name 1 to ${BOT_SKILL_NAME_MAX} of a-z, 0-9 and -; description at most ${BOT_SKILL_DESCRIPTION_MAX}; body at most ${BOT_SKILL_BODY_MAX}; at most ${BOT_SKILLS_MAX} skills. The person sees and edits it in Settings → Skills.`,
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

  private skill(context: BotToolCallContext, name: string): Promise<BotSkillEntity> {
    return this.queryBus.execute<FindBotSkillQuery, BotSkillEntity>(
      new FindBotSkillQuery({ scope: context.owner, botId: context.botId, skill: { name } }),
    );
  }
}
