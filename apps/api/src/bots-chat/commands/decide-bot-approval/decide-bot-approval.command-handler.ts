import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import type { BotEntity } from '../../../bots/domain/bot.entity';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BotApprovedCallResolver } from '../../application/bot-approved-call.resolver';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { approvalEvent, decisionTurn } from '../../domain/bot-approval.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from './decide-bot-approval.command';

/**
 * The owner answers a Needs input card (`25-bots.md` §5). The decision is a
 * conditional write on `pending`, so a second click, or a click racing a new
 * message, loses with `BOTS_016` and does nothing. A yes then runs exactly
 * the stored call as the owner and keeps its answer; a no runs nothing. Either
 * way the bot gets a turn of its own, opened by an event that says what was
 * decided, by whom, and what came of it, so it reports back in the chat.
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
    private readonly calls: BotApprovedCallResolver,
  ) {}

  async execute(command: DecideBotApprovalCommand): Promise<string> {
    const { scope, botId, approvalId, decision, note, deciderName } = command;
    const bot = await this.lookup.bot(scope, botId);
    const approval = requireFound(
      await this.approvals.findOne(scope, bot.id, approvalId),
      BotErrors.APPROVAL_NOT_FOUND,
    );
    if (approval.status !== 'pending') throw new AppError(BotErrors.APPROVAL_DECIDED);
    const asked = await this.turns.findOne(scope, bot.id, approval.turnId);
    const timeZone = asked.isSome() ? asked.unwrap().timeZone : null;

    if (decision === 'approve') approval.approve(scope.userId, new Date());
    else approval.deny(scope.userId, new Date(), note);
    if (!(await this.approvals.saveTransition(approval))) {
      throw new AppError(BotErrors.APPROVAL_DECIDED);
    }
    await this.announce(approval);

    if (decision === 'approve') await this.carryOut(bot, approval, timeZone);
    const event = approvalEvent(approval, deciderName);
    await this.continueWith(bot, scope.userId, timeZone, event, command.metadata.correlationId);
    return approval.id;
  }

  /** Runs the approved call and keeps its answer. */
  private async carryOut(
    bot: BotEntity,
    approval: BotApprovalEntity,
    timeZone: string | null,
  ): Promise<void> {
    const answer = await this.calls.resolve(bot, approval, timeZone);
    approval.recordResult(answer.content, answer.isError);
    await this.approvals.saveTransition(approval);
    await this.announce(approval);
  }

  /** The bot's next turn, opened by the event, queued behind any turn it has. */
  private async continueWith(
    bot: BotEntity,
    userId: string,
    timeZone: string | null,
    event: string,
    correlationId: string,
  ): Promise<void> {
    const { turn, opening } = decisionTurn(
      {
        organizationId: bot.organizationId,
        botId: bot.id,
        requestedByUserId: userId,
        provider: bot.provider,
        model: bot.model ?? botDefaultModel(bot.provider).id,
        effort: bot.effort,
        timeZone,
      },
      event,
    );
    if ((await this.turns.enqueue(turn, opening, correlationId)) === 'missing') {
      throw new AppError(BotErrors.NOT_FOUND);
    }
    await this.stream.publish(bot.id, { type: 'turn', turnId: turn.id, status: 'queued' });
  }

  private announce(approval: BotApprovalEntity): Promise<void> {
    return this.stream.publish(approval.botId, {
      type: 'approval',
      approvalId: approval.id,
      status: approval.status,
    });
  }
}
