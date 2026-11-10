import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WHATSAPP_ACCOUNT_REPOSITORY } from '../../whatsapp.di-tokens';
import { UpdateWhatsappAccountCommand } from './update-whatsapp-account.command';

/**
 * Chooses which of the caller's Oppenheimer bots answers them by default on
 * one of their linked numbers
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1), or
 * none. The bot is read as the caller, so another person's bot is not found
 * (`BOTS_001`); while it is the number's default it cannot be deleted
 * (`BOTS_043`).
 */
@CommandHandler(UpdateWhatsappAccountCommand)
export class UpdateWhatsappAccountCommandHandler
  implements ICommandHandler<UpdateWhatsappAccountCommand, AggregateID>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    scope,
    accountId,
    answeringBotId,
  }: UpdateWhatsappAccountCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(WhatsappErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    if (answeringBotId)
      await this.queryBus.execute(new FindBotQuery({ scope, botId: answeringBotId }));
    account.answerAs(answeringBotId);
    await this.accounts.saveAnswering(account);
    return account.id;
  }
}
