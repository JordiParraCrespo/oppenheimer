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
import { promptText } from '../domain/bot-prompt-text.policy';
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
  .describe(promptText('tools/skills.skill-name-skills-name-skills'));

/**
 * Its skills (from OpenClaw's skills and Grok Bot's saved skills): the bot
 * reads one when a request fits it, saves the way it did a task as one when the
 * person asks or the work was hard and will come again, and fixes one that
 * turned out wrong (Hermes Agent's learning loop). Every tool acts on the
 * turn's bot, its id the context's and never an input. Listed under Itself in
 * Settings → Permissions, beside its documents and memory.
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
      description: promptText('tools/skills.use-skill'),
      input: z.strictObject({ name: skillName }),
      run: async (input, context) => {
        const skill = await this.skillToUse(context, input.name);
        if (!skill.modelInvocable) {
          return promptText('tools/skills.use-skill-read-skill-only', { name: skill.name });
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
      description: promptText('tools/skills.save-skill', {
        skillNameMax: String(BOT_SKILL_NAME_MAX),
        skillDescriptionMax: String(BOT_SKILL_DESCRIPTION_MAX),
        skillBodyMax: String(BOT_SKILL_BODY_MAX),
        skillsMax: String(BOT_SKILLS_MAX),
      }),
      input: z.strictObject({
        name: skillName,
        description: z
          .string()
          .trim()
          .min(1)
          .max(BOT_SKILL_DESCRIPTION_MAX)
          .describe(promptText('tools/skills.skill-name-one-sentence-what')),
        body: z
          .string()
          .trim()
          .min(1)
          .max(BOT_SKILL_BODY_MAX)
          .describe(promptText('tools/skills.save-skill-body')),
        user_invocable: z
          .boolean()
          .optional()
          .describe(promptText('tools/skills.save-skill-user-invocable')),
        model_invocable: z
          .boolean()
          .optional()
          .describe(promptText('tools/skills.save-skill-model-invocable')),
        asked_by_person: z
          .boolean()
          .optional()
          .describe(promptText('tools/skills.save-skill-asked-by-person')),
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
          saved.modelInvocable ? promptText('tools/skills.save-skill-use-when-request') : null,
        ].filter(Boolean);
        return promptText('tools/skills.save-skill-skill-person-can', {
          existing: existing ? 'Updated' : 'Saved',
          name: saved.name,
          runs: runs.join('; '),
        });
      },
    });
  }

  private patchSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'patch_skill',
      scope: 'bots:write',
      description: promptText('tools/skills.patch-skill', {
        skillBodyMax: String(BOT_SKILL_BODY_MAX),
      }),
      input: z.strictObject({
        name: skillName,
        old_text: z
          .string()
          .min(1)
          .max(BOT_SKILL_BODY_MAX)
          .describe(promptText('tools/skills.patch-skill-old-text')),
        new_text: z
          .string()
          .max(BOT_SKILL_BODY_MAX)
          .describe(promptText('tools/skills.patch-skill-new-text')),
        asked_by_person: z
          .boolean()
          .optional()
          .describe(promptText('tools/skills.patch-skill-asked-by-person')),
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
        return promptText('tools/skills.patch-skill-fixed-skill-say', { name: skill.name });
      },
    });
  }

  private deleteSkill(): BotToolDefinition {
    return defineBotTool({
      name: 'delete_skill',
      scope: 'bots:write',
      description: promptText('tools/skills.delete-skill'),
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
        return promptText('tools/skills.delete-skill-deleted-skill-have', {
          name: skill.name,
          leftCount: String(left.length),
        });
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
