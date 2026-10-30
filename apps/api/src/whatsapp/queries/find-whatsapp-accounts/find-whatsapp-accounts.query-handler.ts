import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_DEVICE } from '../../whatsapp.di-tokens';
import { WhatsappAccountMapper } from '../../whatsapp-account.mapper';
import {
  FindWhatsappAccountsQuery,
  type WhatsappAccountView,
} from './find-whatsapp-accounts.query';

/**
 * The caller's own linked numbers, oldest first, each with whether its host
 * is online, read off the link registry rather than stored. None is an empty
 * list; an `id` that is not the caller's is one too.
 */
@QueryHandler(FindWhatsappAccountsQuery)
export class FindWhatsappAccountsQueryHandler
  implements IQueryHandler<FindWhatsappAccountsQuery, WhatsappAccountView[]>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  async execute({ scope, id }: FindWhatsappAccountsQuery): Promise<WhatsappAccountView[]> {
    const accounts = id
      ? (await this.accounts.findOwnById(scope, id)).mapOr([], (account) => [account])
      : await this.accounts.findAllOwn(scope);
    return accounts.map((account) =>
      this.mapper.toView(account, this.device.reach(account.hostId) === 'online'),
    );
  }
}
