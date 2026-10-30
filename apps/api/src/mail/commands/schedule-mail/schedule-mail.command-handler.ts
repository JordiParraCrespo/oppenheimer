import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import { MailSendEntity } from '../../domain/mail-send.entity';
import { scheduleRefusal } from '../../domain/mail-send.policy';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { ScheduleMailCommand } from './schedule-mail.command';

/**
 * Schedules what an approval approved (`product/next-steps/mail.md` §3.4):
 * a `mail_send` row that waits with the plan until its time, when the minute
 * job sends it. Gmail has no scheduled send, so the wait is ours. A retried
 * job finds the same row. The time is checked again here, when the yes
 * lands: a card answered after its time does not send late (`MAIL_016`).
 */
@CommandHandler(ScheduleMailCommand)
export class ScheduleMailCommandHandler
  implements ICommandHandler<ScheduleMailCommand, AggregateID>
{
  constructor(
    private readonly gmail: GmailCallResolver,
    @Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort,
  ) {}

  async execute({
    scope,
    plan,
    sendAt,
    approvalId,
    botId,
  }: ScheduleMailCommand): Promise<AggregateID> {
    const connection = await this.gmail.activeConnection(scope, plan.connectionId);
    const prior = await this.sends.findByApproval(approvalId);
    if (prior.isSome()) return prior.unwrap().id;
    const refusal = scheduleRefusal(sendAt, new Date());
    if (refusal) throw new AppError(MailErrors.SCHEDULE_TIME_REFUSED, { detail: refusal });
    if (plan.attachments.some((file) => file.source !== 'mail')) {
      throw new AppError(MailErrors.SCHEDULE_FILES_REFUSED, {
        detail: 'Attach files from mail, or send it now',
      });
    }
    const send = MailSendEntity.schedule(
      {
        organizationId: connection.organizationId,
        userId: connection.userId,
        connectionId: connection.id,
        botId,
        approvalId,
        kind: plan.kind,
        accountEmail: connection.accountEmail,
        recipients: [...plan.to, ...plan.cc, ...plan.bcc],
        subject: plan.subject.slice(0, 998),
      },
      plan,
      sendAt,
    );
    if (await this.sends.claim(send)) return send.id;
    // Another attempt scheduled this approval between the read and the insert.
    return (await this.sends.findByApproval(approvalId)).unwrapOr(send).id;
  }
}
