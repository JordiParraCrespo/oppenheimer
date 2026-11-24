import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_GOAL_IDLE_TURNS,
  BOT_GOAL_OBJECTIVE_MAX,
  BOT_GOAL_TOKEN_BUDGET_MIN,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BotGoalMapper } from '../bot-goal.mapper';
import { BOT_GOAL_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../database/bot-goal.repository.port';
import { BotGoalEntity } from '../domain/bot-goal.entity';
import { goalPauseLine } from '../domain/bot-goal.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { BotGoalResolver } from './bot-goal.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * A goal the bot keeps working toward (from Codex's and Grok Bot's goals): a
 * continuation turn at a time, with no limit, until it says the goal is met and
 * the reviewer agrees, or the owner stops it. It pauses rather than ends when
 * it is blocked, fails or stops making progress, and the owner resumes it.
 * Neither tool asks: every continuation is a line in the chat, the guards pause
 * what goes wrong, an optional budget bounds the spend, and the owner stops it
 * from there. A continuation cannot set a goal, so a goal never renews itself.
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
      description: promptText('goals/tools.set-goal', {
        goalIdleTurns: String(BOT_GOAL_IDLE_TURNS),
      }),
      input: z.object({
        objective: z
          .string()
          .min(1)
          .max(BOT_GOAL_OBJECTIVE_MAX)
          .describe(promptText('goals/tools.set-goal-objective')),
        token_budget: z
          .number()
          .int()
          .min(BOT_GOAL_TOKEN_BUDGET_MIN)
          .optional()
          .describe(promptText('goals/tools.set-goal-token-budget')),
      }),
      // A continuation is not offered it, so a goal never renews itself.
      notOn: ['goal'],
      run: async (input, context) => {
        const goal = BotGoalEntity.set({
          organizationId: context.organizationId,
          botId: context.botId,
          originTurnId: context.turnId,
          objective: input.objective,
          tokenBudget: input.token_budget ?? null,
          credentialScopes: context.credentialScopes,
          timeZone: context.timeZone,
        });
        const replaced = await this.goalsOf.set(goal);
        return this.mapper.toSetAnswer(goal, replaced);
      },
    });
  }

  private endGoal(): BotToolDefinition {
    return defineBotTool({
      name: 'end_goal',
      scope: 'bots:write',
      description: promptText('goals/tools.end-goal'),
      input: z.object({
        outcome: z.enum(['met', 'blocked']),
        reason: z.string().min(1).max(1_000).describe(promptText('goals/tools.end-goal-reason')),
      }),
      run: async (input, context) => {
        const goal = await this.goals.findForBot(context.organizationId, context.botId);
        if (!goal) return 'You have no goal to end.';
        const ownTurn = context.origin === 'goal' || goal.originTurnId === context.turnId;
        if (input.outcome === 'blocked') {
          goal.pause('blocked', input.reason, new Date());
          if (!(await this.goals.pause(goal, goalPauseLine(goal, 'paused')))) {
            return promptText('goals/tools.end-goal-goal-changed-meanwhile');
          }
          await this.goalsOf.cancelWaiting(goal, null);
          return promptText('goals/tools.end-goal-goal-paused-blocked', {
            objective: goal.objective,
          });
        }
        if (!ownTurn) {
          // No line: the call is the record, in this turn's activity.
          await this.goalsOf.end(goal, null, null);
          return promptText('goals/tools.end-goal-goal-ended-after', {
            continuations: String(goal.continuations),
            objective: goal.objective,
          });
        }
        if (goal.paused) {
          return promptText('goals/tools.end-goal-goal-paused-person');
        }
        goal.claimMet(input.reason);
        if (!(await this.goals.claim(goal))) {
          return promptText('goals/tools.end-goal-goal-changed-meanwhile');
        }
        return promptText('goals/tools.end-goal-noted-when-turn');
      },
    });
  }
}
