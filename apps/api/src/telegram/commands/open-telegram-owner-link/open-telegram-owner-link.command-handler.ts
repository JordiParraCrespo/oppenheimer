import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TelegramErrors } from '../../domain/telegram.errors';
import { TELEGRAM_ACCOUNT_REPOSITORY } from '../../telegram.di-tokens';
import {
  type OpenedTelegramOwnerLink,
  OpenTelegramOwnerLinkCommand,
} from './open-telegram-owner-link.command';

/**
 * A one-time `t.me/<bot>?start=<code>` link for one of the caller's Telegram
 * bots (`product/next-steps/answering-on-telegram-and-whatsapp.md` §2):
 * whoever opens it within ten minutes is recorded as the owner, the only
 * person the bot answers. A new link replaces the open one. The bot's
 * `@username` is the host's to report, so a bot not checked yet has no link.
 */
@CommandHandler(OpenTelegramOwnerLinkCommand)
export class OpenTelegramOwnerLinkCommandHandler
  implements ICommandHandler<OpenTelegramOwnerLinkCommand, OpenedTelegramOwnerLink>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
  ) {}

  async execute({
    scope,
    accountId,
  }: OpenTelegramOwnerLinkCommand): Promise<OpenedTelegramOwnerLink> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(TelegramErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    if (!account.username) {
      throw new AppError(TelegramErrors.NOT_CONNECTED, {
        detail: 'The host has not checked this bot yet, so its Telegram name is not known.',
        extensions: { accountId },
      });
    }
    const { code, expiresAt } = account.openOwnerLink(new Date());
    await this.accounts.save(account);
    return { url: `https://t.me/${account.username}?start=${code}`, expiresAt };
  }
}
