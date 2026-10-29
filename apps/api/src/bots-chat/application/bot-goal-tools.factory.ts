import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_GOAL_CONTINUATIONS_DEFAULT,
  BOT_GOAL_CONTINUATIONS_MAX,
  BOT_GOAL_OBJECTIVE_MAX,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BotGoalMapper } from '../bot-goal.mapper';
import { BOT_GOAL_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../database/bot-goal.repository.port';
import { BotGoalEntity } from '../domain/bot-goal.entity';
import { BotGoalResolver } from './bot-goal.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * A goal the bot sets itself (`25-bots.md` §4.1; from Grok Bot's goals): it
 * keeps going, a continuation turn at a time, until it ends the goal, the
 * owner stops it, a turn of it fails or its continuations run out. Neither
 * tool asks: the spend is bounded by the limit, every continuation is a line
 * in the chat, and the owner stops it from there. A continuation cannot set
 * a goal, so a goal never renews itself.
 */
@Injectable()
export class BotGoalToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    private readonly goalsOf: BotGoalResolver,
    private readonly mapper: BotGoalMapper,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.setGoal(), this.endGoal()];
  }

  private setGoal(): BotToolDefinition {
    return defineBotTool({
      name: 'set_goal',
      scope: 'bots:write',
      description: `Sets a goal you keep working toward across turns, for work that takes several steps on your own: "get the release branch green", "triage every open issue labelled bug". When a turn of yours ends with the goal open, you get a continuation turn to take the next step, at most ${BOT_GOAL_CONTINUATIONS_DEFAULT} unless you ask for up to ${BOT_GOAL_CONTINUATIONS_MAX}; the person sees each one and can stop it. One goal at a time: setting one replaces the last. Not for a task one turn finishes, and not for waiting on a session (watch it instead). Call end_goal when it is met.`,
      input: z.object({
        objective: z
          .string()
          .min(1)
          .max(BOT_GOAL_OBJECTIVE_MAX)
          .describe('What done looks like, in a sentence the person can read.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(BOT_GOAL_CONTINUATIONS_MAX)
          .optional()
          .describe(
            `How many continuation turns it may take (default ${BOT_GOAL_CONTINUATIONS_DEFAULT}).`,
          ),
      }),
      // A continuation is not offered it, so a goal never renews itself.
      notOn: ['goal'],
      run: async (input, context) => {
        const goal = BotGoalEntity.set({
          organizationId: context.organizationId,
          botId: context.botId,
          originTurnId: context.turnId,
          objective: input.objective,
          limit: input.limit ?? BOT_GOAL_CONTINUATIONS_DEFAULT,
          credentialScopes: context.credentialScopes,
          timeZone: context.timeZone,
        });
        const replaced = await this.goals.set(goal);
        // The goal it replaces goes with its waiting continuation.
        if (replaced) await this.goalsOf.cancelWaiting(replaced, null);
        return this.mapper.toSetAnswer(goal, replaced);
      },
    });
  }

  private endGoal(): BotToolDefinition {
    return defineBotTool({
      name: 'end_goal',
      scope: 'bots:write',
      description:
        'Ends your goal: it is met, or it cannot go on without the person. No more continuation turns come. Say why in your reply.',
      input: z.object({}),
      run: async (_input, context) => {
        const goal = await this.goals.findForBot(context.organizationId, context.botId);
        if (!goal) return 'You have no goal to end.';
        // No line: the call is the record, in this turn's activity.
        await this.goalsOf.end(goal, null, null);
        return `Goal ended after ${goal.continuations} of ${goal.limit} continuations: ${goal.objective}`;
      },
    });
  }
}
