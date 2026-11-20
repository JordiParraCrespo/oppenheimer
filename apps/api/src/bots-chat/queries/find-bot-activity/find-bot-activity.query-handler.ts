import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WORKSPACE_BOT_APPROVALS_MAX } from '@oppenheimer/shared';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_QUESTION_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotQuestionRepositoryPort } from '../../database/bot-question.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { type BotActivity, FindBotActivityQuery } from './find-bot-activity.query';

/**
 * What the sidebar shows of each bot, as a session's group is: working while
 * a turn is queued or running, whatever started it; waiting on you while a
 * card of its (an approval, questions) is pending or, once it stopped
 * working, a turn of its failed since you last read the chat. A failure
 * stops waiting once the bot works again: a new message answered it.
 * `botTurn.changed` and `botApproval.changed` say when to read it again; a
 * card of questions ends its turn and an answer queues one, so the first
 * covers questions.
 */
@QueryHandler(FindBotActivityQuery)
export class FindBotActivityQueryHandler
  implements IQueryHandler<FindBotActivityQuery, BotActivity>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
  ) {}

  async execute({ scope }: FindBotActivityQuery): Promise<BotActivity> {
    const [working, approvals, questions, failed] = await Promise.all([
      this.turns.findWorkingBotIds(scope),
      this.approvals.findInWorkspace(scope, 'pending', WORKSPACE_BOT_APPROVALS_MAX),
      this.questions.findPendingBotIds(scope),
      this.turns.findBotIdsWithUnreadFailure(scope),
    ]);
    const busy = new Set(working);
    const waiting = new Set([
      ...approvals.map((approval) => approval.botId),
      ...questions,
      ...failed.filter((botId) => !busy.has(botId)),
    ]);
    return { working, waitingOnYou: [...waiting] };
  }
}
