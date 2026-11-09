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
import { BotGoalResolver } from './bot-goal.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * A goal the bot keeps working toward (`25-bots.md` §4.1; from Codex's and
 * Grok Bot's goals): a continuation turn at a time, with no limit, until it
 * says the goal is met and the reviewer agrees, or the owner stops it. It
 * pauses rather than ends when it is blocked, fails or stops making
 * progress, and the owner resumes it. Neither tool asks: every continuation
 * is a line in the chat, the guards pause what goes wrong, an optional
 * budget bounds the spend, and the owner stops it from there. A continuation
 * cannot set a goal, so a goal never renews itself.
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
      description: `Sets a goal you keep working toward across turns, for work that takes several steps on your own: "get the release branch green", "triage every open issue labelled bug". Write it as a condition with the check that proves it ("pnpm test exits 0 on the release branch"). After each of your turns another comes, with no limit, until you call end_goal with outcome met and a reviewer agrees from what you showed; the person sees each one and can stop it. It pauses after ${BOT_GOAL_IDLE_TURNS} turns in a row that call no tool, and when a turn fails. One goal at a time: setting one replaces the last. Not for a task one turn finishes, and not for waiting on a session (watch it instead).`,
      input: z.object({
        objective: z
          .string()
          .min(1)
          .max(BOT_GOAL_OBJECTIVE_MAX)
          .describe('What done looks like, and how to check it, in words the person can read.'),
        token_budget: z
          .number()
          .int()
          .min(BOT_GOAL_TOKEN_BUDGET_MIN)
          .optional()
          .describe(
            'The most tokens its turns may spend, input and output, before it pauses. Only when the person names a budget; none by default.',
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
      description:
        "Says your goal is done or stuck. outcome met: you ran its check and it holds; when this turn ends a reviewer reads what you showed and ends the goal, or sends you on with its reason. outcome blocked: it cannot go on without the person; it pauses until they resume it. Say why in reason and in your reply. Outside the goal's own turns (the person asked you to stop it), met ends it at once.",
      input: z.object({
        outcome: z.enum(['met', 'blocked']),
        reason: z
          .string()
          .min(1)
          .max(1_000)
          .describe('For met, the check you ran and what it answered; for blocked, what you need.'),
      }),
      run: async (input, context) => {
        const goal = await this.goals.findForBot(context.organizationId, context.botId);
        if (!goal) return 'You have no goal to end.';
        const ownTurn = context.origin === 'goal' || goal.originTurnId === context.turnId;
        if (input.outcome === 'blocked') {
          goal.pause('blocked', input.reason, new Date());
          if (!(await this.goals.pause(goal, goalPauseLine(goal, 'paused')))) {
            return 'Your goal changed meanwhile (it was paused, ended or replaced); nothing was done.';
          }
          await this.goalsOf.cancelWaiting(goal, null);
          return `Goal paused as blocked: ${goal.objective}. It stays open until the person resumes it.`;
        }
        if (!ownTurn) {
          // No line: the call is the record, in this turn's activity.
          await this.goalsOf.end(goal, null, null);
          return `Goal ended after ${goal.continuations} continuations: ${goal.objective}`;
        }
        if (goal.paused) {
          return 'Your goal is paused; the person resumes it. Say in your reply what you found.';
        }
        goal.claimMet(input.reason);
        if (!(await this.goals.claim(goal))) {
          return 'Your goal changed meanwhile (it was paused, ended or replaced); nothing was done.';
        }
        return 'Noted. When this turn ends a reviewer reads what you showed: the goal ends if it holds, otherwise your next turn says why not. Finish the turn by reporting the check and its result.';
      },
    });
  }
}
