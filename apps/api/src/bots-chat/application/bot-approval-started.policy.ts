import { Inject, Injectable } from '@nestjs/common';
import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { BotMessageEvent } from '@oppenheimer/shared';
import { BOT_APPROVAL_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../database/bot-approval.repository.port';
import { approvalStartedBy } from '../domain/bot-approval.policy';

/**
 * Model round trips in the turn a yes opens: one to say the bot is on it,
 * and one more should it reach for a tool anyway.
 */
export const APPROVAL_STARTED_MAX_STEPS = 2;

/** What a tool answers in that turn: nothing runs, the report comes next. */
export const APPROVAL_STARTED_REFUSAL =
  'Not in this turn: the call they approved is still running. Say in one sentence that you are on it and end your turn; how it went comes in your next turn.';

/** What a turn runs with, and whether a message sent meanwhile may steer it. */
export interface BotTurnShape<Request> {
  request: Request;
  takesSteers: boolean;
}

/**
 * The one place that knows the turn a yes opens at once (`25-bots.md` §5),
 * where the bot only says it is on it while the approved call runs. Every
 * turn passes here as it is about to run; any other comes back as it is.
 * That one keeps the bot's usual tools, so the provider's cache of the
 * conversation, keyed on them, still holds, but each refuses to run; it gets
 * two round trips; and it takes no steer, since a message it took would never
 * be acted on. Once its call ran, the turn that reports it says it all, so
 * this one has nothing to say: an "on it" after the fact, or after the
 * report, reads backwards.
 */
@Injectable()
export class BotApprovalStartedPolicy {
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  /** How a turn with this opening runs; null when it has nothing left to say. */
  async shape<Request extends { tools: BotEngineTool[]; maxSteps?: number }>(
    opening: { role: string; event?: BotMessageEvent | null } | null,
    request: Request,
  ): Promise<BotTurnShape<Request> | null> {
    const approvalId = approvalStartedBy(opening);
    if (!approvalId) return { request, takesSteers: true };
    const found = await this.approvals.findForRun(approvalId);
    if (found.isSome() && !found.unwrap().running) return null;
    return {
      request: {
        ...request,
        tools: request.tools.map((tool) => ({
          ...tool,
          run: async () => ({ content: APPROVAL_STARTED_REFUSAL, isError: true }),
        })),
        maxSteps: APPROVAL_STARTED_MAX_STEPS,
      },
      takesSteers: false,
    };
  }
}
