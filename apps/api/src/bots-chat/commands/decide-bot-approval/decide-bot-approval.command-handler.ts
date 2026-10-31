import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { decideApproval } from '../../application/bot-approval-decision.policy';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { approvalResolved } from '../../domain/bot-approval.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from './decide-bot-approval.command';

/**
 * The owner answers a Needs input card (`25-bots.md` §5) with one of the
 * decisions it offers (`availableDecisions`); any other is `BOTS_030`. The
 * decision is a conditional write on `pending`, so a second click, or a click
 * racing a new message, loses with `BOTS_016` and writes nothing. What it
 * owes (`decideApproval`) is written with it, a stop then stops the asking
 * turn, and every open chat hears the card closed (`approval_resolved`).
 */
@CommandHandler(DecideBotApprovalCommand)
export class DecideBotApprovalCommandHandler
  implements ICommandHandler<DecideBotApprovalCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute(command: DecideBotApprovalCommand): Promise<string> {
    const { scope, botId, approvalId, decision } = command;
    const bot = await this.lookup.bot(scope, botId);
    const approval = requireFound(
      await this.approvals.findOne(scope, bot.id, approvalId),
      BotErrors.APPROVAL_NOT_FOUND,
    );
    if (approval.status !== 'pending') throw new AppError(BotErrors.APPROVAL_DECIDED);
    const offered = approval.availableDecisions;
    if (!offered.includes(decision)) {
      throw new AppError(BotErrors.TOOL_PER_CALL, {
        detail: `This card offers ${offered.join(', ')}, not ${decision}`,
      });
    }
    const found = await this.turns.findOne(scope, bot.id, approval.turnId);
    const asked = found.isSome() ? found.unwrap() : null;
    const now = new Date();
    const { effects, cancelAsking } = decideApproval(
      approval,
      decision,
      {
        userId: scope.userId,
        name: command.deciderName,
        scopes: command.credentialScopes,
        note: command.note,
      },
      { bot, asked, now },
    );
    if (!(await this.approvals.saveTransition(approval, effects, command.metadata.correlationId))) {
      throw new AppError(BotErrors.APPROVAL_DECIDED);
    }
    if (cancelAsking && asked) await this.turns.requestCancel(asked, now);

    const publish = (event: Parameters<BotStreamPort['publish']>[1]) =>
      this.stream.publish(bot.id, event);
    await publish({ type: 'approval', approvalId: approval.id, status: approval.status });
    await publish(approvalResolved(approval, decision));
    if (effects.line) await publish({ type: 'message', turnId: null, messageId: effects.line.id });
    if (effects.continuation) {
      await publish({ type: 'turn', turnId: effects.continuation.turn.id, status: 'queued' });
    }
    return approval.id;
  }
}
