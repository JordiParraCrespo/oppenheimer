import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import type { MailSendEntity } from '../../domain/mail-send.entity';
import { dailyRefusal, dayBefore } from '../../domain/mail-send.policy';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { SendDueMailCommand } from './send-due-mail.command';

/** How many due sends one tick takes; the rest wait for the next minute. */
const DUE_PER_TICK = 50;

/**
 * Sends the scheduled mail that is due (`product/next-steps/mail.md` §3.4),
 * each as the plan it was approved with. Each is claimed with a conditional
 * write before Gmail is asked, so a cancel, another replica or the next tick
 * cannot send it twice; a claimed send that then fails is recorded as failed
 * and never retried on its own. The daily cap counts it like any send. One
 * send failing does not stop the others.
 */
@CommandHandler(SendDueMailCommand)
export class SendDueMailCommandHandler implements ICommandHandler<SendDueMailCommand, number> {
  private readonly logger = new Logger(SendDueMailCommandHandler.name);

  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
    @Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort,
  ) {}

  async execute({ now }: SendDueMailCommand): Promise<number> {
    let sent = 0;
    for (const send of await this.sends.findDue(now, DUE_PER_TICK)) {
      if (!(await this.sends.claimDue(send))) continue;
      try {
        await this.deliver(send);
        sent += 1;
      } catch (error) {
        send.failed(new Date());
        await this.sends.save(send);
        this.logger.warn({
          message: 'A scheduled mail was not sent',
          sendId: send.id,
          code: error instanceof AppError ? error.code : undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return sent;
  }

  private async deliver(send: MailSendEntity): Promise<void> {
    const plan = send.plan;
    if (!plan || !send.connectionId) {
      throw new AppError(MailErrors.GMAIL_NOT_CONNECTED, {
        detail: 'The account it was to go from is gone',
      });
    }
    const scope = emptyScope(send.userId, send.organizationId);
    const connection = await this.gmail.activeConnection(scope, send.connectionId);
    // Claimed, it is going out already: the cap is about the sends before it.
    const daily = dailyRefusal(
      await this.sends.countSince(connection.id, dayBefore(new Date()), send.id),
    );
    if (daily) throw new AppError(MailErrors.DAILY_LIMIT_REACHED, { detail: daily });
    const sent = await this.gmail.call(connection, (provider, grant) =>
      this.compose.deliver(provider, grant, plan, new Map()),
    );
    send.sent(sent.messageId, sent.threadId, new Date());
    await this.sends.save(send);
  }
}
