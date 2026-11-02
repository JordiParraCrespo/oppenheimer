import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import type { MailSendEntity } from '../../domain/mail-send.entity';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { FindScheduledMailQuery } from './find-scheduled-mail.query';

/** How many waiting sends a list shows: a bot schedules few, and each was asked. */
const SCHEDULED_LIST_MAX = 100;

@QueryHandler(FindScheduledMailQuery)
export class FindScheduledMailQueryHandler
  implements IQueryHandler<FindScheduledMailQuery, MailSendEntity[]>
{
  constructor(@Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort) {}

  execute({ scope }: FindScheduledMailQuery): Promise<MailSendEntity[]> {
    return this.sends.findScheduledOwn(scope, SCHEDULED_LIST_MAX);
  }
}
