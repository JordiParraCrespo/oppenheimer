import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { MAIL_SENDS_PER_DAY } from '@oppenheimer/shared';
import { emptyScope } from '../../../authz/domain/access-scope.types';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import type { MailSendEntity } from '../../domain/mail-send.entity';
import { dayBefore } from '../../domain/mail-send.policy';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { SendDueMailCommand } from './send-due-mail.command';

/** How many due sends are read at once. */
const DUE_PER_BATCH = 50;
/** How long a tick keeps taking batches; what is left goes on the next one. */
const TICK_BUDGET_MS = 45_000;

/**
 * Sends the scheduled mail that is due (`product/next-steps/mail.md` §3.4),
 * each as the plan it was approved with. Each is claimed with a conditional
 * write before Gmail is asked, so a cancel, another replica or the next tick
 * cannot send it twice; a claimed send that then fails is recorded as failed
 * and never retried on its own. The claim takes the account's daily cap
 * under the same lock as an immediate send; one past it is recorded as
 * failed. One send failing does not stop the others.
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
    const started = Date.now();
    let sent = 0;
    let due: MailSendEntity[];
    // Batch after batch while the tick has time: a busy minute still goes within it.
    do {
      due = await this.sends.findDue(now, DUE_PER_BATCH);
      for (const send of due) sent += await this.sendOne(send, now);
    } while (due.length === DUE_PER_BATCH && Date.now() - started <= TICK_BUDGET_MS);
    return sent;
  }

  /** One due send: claimed under the account's daily cap, then sent as its plan. */
  private async sendOne(send: MailSendEntity, now: Date): Promise<number> {
    const claim = await this.sends.claimDueUnderCap(send, dayBefore(now), MAIL_SENDS_PER_DAY);
    if (claim.outcome === 'taken') return 0;
    if (claim.outcome === 'over_cap') {
      this.logger.warn({
        message: 'A scheduled mail was not sent: the account is at its daily limit',
        sendId: send.id,
        sentInWindow: claim.sentInWindow,
      });
      return 0;
    }
    try {
      await this.deliver(send);
      return 1;
    } catch (error) {
      send.failed(new Date());
      await this.sends.save(send);
      this.logger.warn({
        message: 'A scheduled mail was not sent',
        sendId: send.id,
        code: error instanceof AppError ? error.code : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
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
    const sent = await this.gmail.call(connection, (provider, grant) =>
      this.compose.deliver(provider, grant, plan, new Map()),
    );
    send.sent(sent.messageId, sent.threadId, new Date());
    await this.sends.save(send);
  }
}
