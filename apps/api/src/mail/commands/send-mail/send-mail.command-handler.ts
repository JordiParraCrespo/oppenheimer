import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MAIL_SENDS_PER_DAY } from '@oppenheimer/shared';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import { MailSendEntity } from '../../domain/mail-send.entity';
import { dailyRefusal, dayBefore, priorSendRefusal } from '../../domain/mail-send.policy';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { SendMailCommand } from './send-mail.command';

/**
 * Sends what an approval approved (`product/next-steps/mail.md` §3.4), once.
 * The send is claimed under the approval's id before Gmail is asked, so a
 * retried job finds it: sent, it answers the same send; started and never
 * confirmed, it refuses rather than risk a second copy (`MAIL_015`). The
 * daily cap counts what went out and what is going, in the same locked step
 * as the claim, so replicas cannot both take the last place. A draft is sent
 * only if it is still the version the card showed (`MAIL_014`).
 */
@CommandHandler(SendMailCommand)
export class SendMailCommandHandler implements ICommandHandler<SendMailCommand, AggregateID> {
  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
    @Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort,
  ) {}

  async execute({
    scope,
    plan,
    approvalId,
    botId,
    localFiles,
  }: SendMailCommand): Promise<AggregateID> {
    const connection = await this.gmail.activeConnection(scope, plan.connectionId);
    const prior = await this.sends.findByApproval(approvalId);
    if (prior.isSome()) return outcomeOf(prior.unwrap());
    const send = MailSendEntity.claim({
      organizationId: connection.organizationId,
      userId: connection.userId,
      connectionId: connection.id,
      botId,
      approvalId,
      kind: plan.kind,
      accountEmail: connection.accountEmail,
      recipients: [...plan.to, ...plan.cc, ...plan.bcc],
      subject: plan.subject.slice(0, 998),
    });
    const claim = await this.sends.claimUnderCap(send, dayBefore(new Date()), MAIL_SENDS_PER_DAY);
    if (claim.outcome === 'over_cap') {
      throw new AppError(MailErrors.DAILY_LIMIT_REACHED, {
        detail: dailyRefusal(claim.sentInWindow) ?? undefined,
      });
    }
    if (claim.outcome === 'taken') {
      // Another attempt claimed this approval between the read and the insert.
      const raced = await this.sends.findByApproval(approvalId);
      return outcomeOf(raced.isSome() ? raced.unwrap() : send);
    }
    try {
      const sent = await this.gmail.call(connection, (provider, grant) =>
        this.compose.deliver(provider, grant, plan, localFiles),
      );
      send.sent(sent.messageId, sent.threadId, new Date());
    } catch (error) {
      send.failed(new Date());
      await this.sends.save(send);
      throw error;
    }
    await this.sends.save(send);
    return send.id;
  }
}

/** What an approval's earlier send answers: the same send, or a refusal to risk another. */
function outcomeOf(prior: MailSendEntity): AggregateID {
  const refusal = priorSendRefusal(prior.status);
  if (refusal) throw new AppError(MailErrors.SEND_UNCONFIRMED, { detail: refusal });
  return prior.id;
}
