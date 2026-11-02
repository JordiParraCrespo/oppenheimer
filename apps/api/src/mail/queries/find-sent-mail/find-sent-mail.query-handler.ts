import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MailSendRepositoryPort } from '../../database/mail-send.repository.port';
import type { MailSendEntity } from '../../domain/mail-send.entity';
import { MAIL_SEND_REPOSITORY } from '../../mail.di-tokens';
import { FindSentMailQuery } from './find-sent-mail.query';

@QueryHandler(FindSentMailQuery)
export class FindSentMailQueryHandler
  implements IQueryHandler<FindSentMailQuery, MailSendEntity[]>
{
  constructor(@Inject(MAIL_SEND_REPOSITORY) private readonly sends: MailSendRepositoryPort) {}

  async execute({ scope, limit }: FindSentMailQuery): Promise<MailSendEntity[]> {
    return this.sends.findRecentOwn(scope, limit);
  }
}
