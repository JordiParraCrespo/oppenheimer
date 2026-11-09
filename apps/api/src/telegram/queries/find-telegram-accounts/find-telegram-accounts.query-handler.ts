import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { TelegramDevicePort } from '../../application/telegram-device.port';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_DEVICE } from '../../telegram.di-tokens';
import { TelegramAccountMapper } from '../../telegram-account.mapper';
import {
  FindTelegramAccountsQuery,
  type TelegramAccountView,
} from './find-telegram-accounts.query';

/**
 * The caller's own connected Telegram bots, oldest first, each with whether its host
 * is online, read off the link registry rather than stored. None is an empty
 * list; an `id` that is not the caller's is one too.
 */
@QueryHandler(FindTelegramAccountsQuery)
export class FindTelegramAccountsQueryHandler
  implements IQueryHandler<FindTelegramAccountsQuery, TelegramAccountView[]>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    private readonly mapper: TelegramAccountMapper,
  ) {}

  async execute({ scope, id }: FindTelegramAccountsQuery): Promise<TelegramAccountView[]> {
    const accounts = id
      ? (await this.accounts.findOwnById(scope, id)).mapOr([], (account) => [account])
      : await this.accounts.findAllOwn(scope);
    return accounts.map((account) =>
      this.mapper.toView(account, this.device.reach(account.hostId) === 'online'),
    );
  }
}
