import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import {
  type WhatsappImageSight,
  whatsappImageMissReason,
  whatsappImageSightOf,
} from '../../domain/whatsapp-image.policy';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_DEVICE,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { SeeWhatsappImageCommand } from './see-whatsapp-image.command';

/**
 * Fetches an image for a bot to see: the host hands it over
 * (`whatsapp.media.get`, `kind: 'image'`), scaled down to one frame when
 * WhatsApp's is larger, and it is answered only as a type a bot's chat
 * takes (`whatsappImageSightOf`). Nothing of it is kept here; the bot's chat keeps the
 * copy its turn was sent. Every way fetching can fail is an answer, so the
 * turn runs all the same and the bot can say it could not see it.
 */
@CommandHandler(SeeWhatsappImageCommand)
export class SeeWhatsappImageCommandHandler
  implements ICommandHandler<SeeWhatsappImageCommand, WhatsappImageSight>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_DEVICE) private readonly device: WhatsappDevicePort,
  ) {}

  async execute(command: SeeWhatsappImageCommand): Promise<WhatsappImageSight> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    if (found.isNone()) return { seen: false, reason: 'the WhatsApp number was removed' };
    const account = found.unwrap();
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const message = await this.messages.findById(ref, command.messageRowId);
    if (message?.media !== 'image') return { seen: false, reason: 'it is no longer kept' };
    const image = await this.device.image(account.hostId, message.chatId, message.externalId);
    if (image.kind !== 'fetched') return { seen: false, reason: whatsappImageMissReason(image) };
    return whatsappImageSightOf(image.data, image.mimetype);
  }
}
