import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { BOT_TOOL_GRANTS_MAX, botDefaultModel } from '@oppenheimer/shared';
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
import {
  approvalResolved,
  decisionOf,
  decisionTurn,
  intersectScopes,
  reachOf,
  stoppedLine,
} from '../../domain/bot-approval.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { DecideBotApprovalCommand } from './decide-bot-approval.command';

/**
 * The owner answers a Needs input card (`25-bots.md` §5) with one of the
 * decisions it offers (`availableDecisions`); any other is `BOTS_030`. The
 * decision is a conditional write on `pending`, so a second click, or a click
 * racing a new message, loses with `BOTS_016` and writes nothing. What it
 * owes is written with it: a yes stages the `run-approved-call` job (a crash
 * leaves a job to retry, never a card stuck approved); a no queues the turn
 * that tells the bot; a no that stops writes its line outside any turn,
 * queues none, and asks the asking turn to stop if it still runs. The
 * decider's scopes are kept and narrow the call and its report. Open chats hear it closed.
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
    const { scope, botId, approvalId, note, deciderName, credentialScopes } = command;
    const bot = await this.lookup.bot(scope, botId);
    const approval = requireFound(
      await this.approvals.findOne(scope, bot.id, approvalId),
      BotErrors.APPROVAL_NOT_FOUND,
    );
    if (approval.status !== 'pending') throw new AppError(BotErrors.APPROVAL_DECIDED);
    const decision = decisionOf(command.decision, command.reach);
    const offered = approval.availableDecisions;
    if (!offered.includes(decision)) {
      throw new AppError(BotErrors.TOOL_PER_CALL, {
        detail: `This card offers ${offered.join(', ')}, not ${decision}`,
      });
    }
    const now = new Date();
    const reach = reachOf(decision);
    const found = await this.turns.findOne(scope, bot.id, approval.turnId);
    const asked = found.isSome() ? found.unwrap() : null;

    let effects: BotApprovalEffects;
    if (reach) {
      approval.approve(scope.userId, now, credentialScopes, reach);
      const permission = approval.standing();
      effects = {
        runCall: { by: deciderName },
        ...(permission && { standing: { permission, maxGrants: BOT_TOOL_GRANTS_MAX } }),
      };
    } else {
      approval.deny(scope.userId, now, note, credentialScopes);
      effects =
        decision === 'stop'
          ? { line: stoppedLine(approval, deciderName) }
          : {
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
    if (decision === 'stop' && asked?.status === 'running') {
      await this.turns.requestCancel(asked, now);
    }
    const publish = this.stream.publish.bind(this.stream, bot.id);
    await publish({ type: 'approval', approvalId: approval.id, status: approval.status });
    await publish(approvalResolved(approval, decision));
    if (effects.line) await publish({ type: 'message', turnId: null, messageId: effects.line.id });
    if (effects.continuation) {
      await publish({ type: 'turn', turnId: effects.continuation.turn.id, status: 'queued' });
    }
    return approval.id;
  }
}
