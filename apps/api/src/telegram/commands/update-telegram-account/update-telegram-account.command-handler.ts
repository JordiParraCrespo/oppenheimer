import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TelegramErrors } from '../../domain/telegram.errors';
import { TELEGRAM_ACCOUNT_REPOSITORY } from '../../telegram.di-tokens';
import { UpdateTelegramAccountCommand } from './update-telegram-account.command';

/**
 * Chooses which of the caller's Oppenheimer bots answers them on one of
 * their Telegram bots (`product/next-steps/answering-on-telegram-and-whatsapp.md`
 * §1), or none. The bot is read as the caller, so another person's bot is
 * not found (`BOTS_001`); while it answers here it cannot be deleted.
 */
@CommandHandler(UpdateTelegramAccountCommand)
export class UpdateTelegramAccountCommandHandler
  implements ICommandHandler<UpdateTelegramAccountCommand, AggregateID>
{
  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    scope,
    accountId,
    answeringBotId,
  }: UpdateTelegramAccountCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(TelegramErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    if (answeringBotId)
      await this.queryBus.execute(new FindBotQuery({ scope, botId: answeringBotId }));
    account.answerAs(answeringBotId);
    await this.accounts.saveAnswering(account);
    return account.id;
  }
}
