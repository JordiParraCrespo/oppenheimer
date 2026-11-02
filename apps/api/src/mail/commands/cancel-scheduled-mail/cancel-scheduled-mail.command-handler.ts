import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { CancelScheduledMailCommand } from './cancel-scheduled-mail.command';

/**
 * Cancels a scheduled send, only while it waits: the write is conditional on
 * its state, so a cancel and the minute job's claim cannot both win. One
 * already going, sent, cancelled or someone else's is `MAIL_017`.
 */
@CommandHandler(CancelScheduledMailCommand)
export class CancelScheduledMailCommandHandler
  implements ICommandHandler<CancelScheduledMailCommand, AggregateID>
{
  constructor(@Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort) {}

  async execute({ scope, sendId }: CancelScheduledMailCommand): Promise<AggregateID> {
    if (!(await this.sends.cancelOwn(scope, sendId))) {
      throw new AppError(MailErrors.SCHEDULED_NOT_FOUND, {
        detail: 'It was sent, cancelled, or never scheduled by you',
      });
    }
    return sendId;
  }
}
