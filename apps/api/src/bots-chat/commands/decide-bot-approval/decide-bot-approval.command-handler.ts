import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type {
  BotApprovalEffects,
  BotApprovalRepositoryPort,
} from '../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { decisionTurn, intersectScopes } from '../../domain/bot-approval.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from './decide-bot-approval.command';

/**
 * The owner answers a Needs input card (`25-bots.md` §5). The decision is a
 * conditional write on `pending`, so a second click, or a click racing a new
 * message, loses with `BOTS_016` and writes nothing. What it owes commits
 * with it: a yes stages the `run-approved-call` job (the call runs there, so
 * a crash leaves a job to retry, never a card stuck approved); a no queues
 * the bot's turn that is told so. The deciding credential's scopes are kept
 * on the approval: the call, and the turn that reports it, get only what
 * both they and the asking turn's cover.
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
    const { scope, botId, approvalId, decision, note, deciderName, credentialScopes } = command;
    const bot = await this.lookup.bot(scope, botId);
    const approval = requireFound(
      await this.approvals.findOne(scope, bot.id, approvalId),
      BotErrors.APPROVAL_NOT_FOUND,
    );
    if (approval.status !== 'pending') throw new AppError(BotErrors.APPROVAL_DECIDED);

    let effects: BotApprovalEffects;
    if (decision === 'approve') {
      approval.approve(scope.userId, new Date(), credentialScopes);
      effects = { runCall: { by: deciderName } };
    } else {
      approval.deny(scope.userId, new Date(), note, credentialScopes);
      const found = await this.turns.findOne(scope, bot.id, approval.turnId);
      const asked = found.isSome() ? found.unwrap() : null;
      effects = {
        continuation: decisionTurn(
          {
            organizationId: bot.organizationId,
            botId: bot.id,
            requestedByUserId: scope.userId,
            provider: bot.provider,
            model: bot.model ?? botDefaultModel(bot.provider).id,
            effort: bot.effort,
            timeZone: asked?.timeZone ?? null,
            credentialScopes: intersectScopes(
              asked ? asked.credentialScopes : [],
              credentialScopes,
            ),
          },
          approval,
          deciderName,
        ),
      };
    }
    if (!(await this.approvals.saveTransition(approval, effects, command.metadata.correlationId))) {
      throw new AppError(BotErrors.APPROVAL_DECIDED);
    }
    await this.stream.publish(bot.id, {
      type: 'approval',
      approvalId: approval.id,
      status: approval.status,
    });
    if (effects.continuation) {
      const { turn } = effects.continuation;
      await this.stream.publish(bot.id, { type: 'turn', turnId: turn.id, status: 'queued' });
    }
    return approval.id;
  }
}
