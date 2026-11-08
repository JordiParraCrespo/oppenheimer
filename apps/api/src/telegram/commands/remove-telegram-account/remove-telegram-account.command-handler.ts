import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TelegramDevicePort } from '../../application/telegram-device.port';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_DEVICE } from '../../telegram.di-tokens';
import { RemoveTelegramAccountCommand } from './remove-telegram-account.command';

/**
 * Disconnects one of the caller's Telegram bots: asks its host to stop
 * polling and forget the token and outbox, and forgets the bot and its
 * messages. A host that is offline is told when it next reports a bot the
 * control plane no longer knows (`RecordTelegramStateCommandHandler`). An id
 * that is not one of the caller's does nothing.
 */
@CommandHandler(RemoveTelegramAccountCommand)
export class RemoveTelegramAccountCommandHandler
  implements ICommandHandler<RemoveTelegramAccountCommand, void>
{
  constructor(
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
  ) {}

  async execute({ scope, accountId }: RemoveTelegramAccountCommand): Promise<void> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) return;
    const account = found.unwrap();
    this.device.unlink(account.hostId);
    await this.accounts.delete(account);
  }
}
