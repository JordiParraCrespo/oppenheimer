import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { botDefaultModel } from '@oppenheimer/shared';
import { BOT_REPOSITORY } from '../../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import { BotApprovedCallResolver } from '../../application/bot-approved-call.resolver';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { decisionTurn, intersectScopes } from '../../domain/bot-approval.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { RunApprovedCallCommand } from './run-approved-call.command';

/**
 * Carries out an approved call (`25-bots.md` §5), from the job the yes staged.
 * It runs only while the approval is approved with no result: a retry after
 * the result landed does nothing. The call runs as the owner under what both
 * the asking turn's and the deciding credential's scopes cover; its answer
 * and the turn that reports it back are written together, conditioned on no
 * result yet, so a second run of the job never reports twice. The call
 * itself is keyed by the approval, so a job that died after running it and
 * before the write runs it again to no new effect.
 */
@CommandHandler(RunApprovedCallCommand)
export class RunApprovedCallCommandHandler
  implements ICommandHandler<RunApprovedCallCommand, void>
{
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly calls: BotApprovedCallResolver,
  ) {}

  async execute({ approvalId, by, metadata }: RunApprovedCallCommand): Promise<void> {
    const found = await this.approvals.findForRun(approvalId);
    if (found.isNone() || !found.unwrap().running) return;
    const approval = found.unwrap();
    const bot = await this.bots.findForTurn(approval.organizationId, approval.botId);
    if (bot.isNone()) return;
    const askedFound = await this.turns.findForRun(approval.turnId);
    const asked = askedFound.isSome() ? askedFound.unwrap() : null;
    // No asking turn left means no scopes to run under: nothing runs.
    const granted = intersectScopes(
      asked ? asked.credentialScopes : [],
      approval.decidedWithScopes,
    );
    const answer = await this.calls.resolve(
      bot.unwrap(),
      approval,
      granted,
      asked?.timeZone ?? null,
    );
    approval.recordResult(answer.content, answer.isError);
    const owner = bot.unwrap();
    // An approver whose account is gone gets no report: there is nobody to send it as.
    const continuation = approval.decidedByUserId
      ? decisionTurn(
          {
            organizationId: owner.organizationId,
            botId: owner.id,
            requestedByUserId: approval.decidedByUserId,
            provider: owner.provider,
            model: owner.model ?? botDefaultModel(owner.provider).id,
            effort: owner.effort,
            timeZone: asked?.timeZone ?? null,
            credentialScopes: granted,
          },
          approval,
          by,
        )
      : undefined;
    if (
      !(await this.approvals.saveTransition(approval, { continuation }, metadata.correlationId))
    ) {
      return;
    }
    await this.stream.publish(approval.botId, {
      type: 'approval',
      approvalId: approval.id,
      status: approval.status,
    });
    if (continuation) {
      await this.stream.publish(approval.botId, {
        type: 'turn',
        turnId: continuation.turn.id,
        status: 'queued',
      });
    }
  }
}
