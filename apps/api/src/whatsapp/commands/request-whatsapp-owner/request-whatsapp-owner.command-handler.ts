import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { whatsappPhoneDigits } from '@oppenheimer/shared';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import { whatsappSentOrThrow } from '../../application/whatsapp-send-outcome.policy';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { whatsappOwnerCodeLine } from '../../domain/whatsapp-owner-code.policy';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_DEVICE,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { WhatsappMessageMapper } from '../../whatsapp-message.mapper';
import { RequestWhatsappOwnerCommand } from './request-whatsapp-owner.command';

/**
 * The owner names their own number on one of their linked numbers
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1): the linked
 * number sends it a six-digit code, which the owner then enters in Settings.
 * Only the code's hash is kept. A new request replaces a waiting code, and
 * the confirmed owner stays until another number is confirmed. The line is
 * kept with the chat with its digits masked, so no bot reads the code. The code is
 * saved before it is sent, so it works however fast it arrives; a send that
 * fails forgets it again and is told in the module's own codes.
 */
@CommandHandler(RequestWhatsappOwnerCommand)
export class RequestWhatsappOwnerCommandHandler
  implements ICommandHandler<RequestWhatsappOwnerCommand, AggregateID>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    private readonly mapper: WhatsappMessageMapper,
  ) {}

  async execute({ scope, accountId, phone }: RequestWhatsappOwnerCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(WhatsappErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    if (!account.isConnected) {
      throw new AppError(WhatsappErrors.NOT_CONNECTED, {
        detail: `The number is ${account.status}.`,
      });
    }
    const chatId = `${whatsappPhoneDigits(phone)}@s.whatsapp.net`;
    const named = account.nameOwner(chatId, new Date());
    if (!named) {
      throw new AppError(WhatsappErrors.OWNER_NUMBER_INVALID, {
        detail: 'Name your own number, not the one linked here.',
      });
    }
    await this.accounts.saveOwnerCode(account);
    const text = whatsappOwnerCodeLine(named.code);
    let sent: { id: string; sentAt: Date };
    try {
      sent = whatsappSentOrThrow(await this.device.send(account.hostId, chatId, text));
    } catch (error) {
      account.forgetOwnerCode();
      await this.accounts.saveOwnerCode(account);
      throw error;
    }
    await this.messages.recordBotSend(
      this.mapper.fromBotSend({
        account,
        chat: { chatId, chatKind: 'direct', chatName: null },
        text: whatsappOwnerCodeLine(null),
        sent,
        botId: null,
      }),
    );
    return account.id;
  }
}
