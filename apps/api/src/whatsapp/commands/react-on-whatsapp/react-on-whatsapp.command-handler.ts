import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { WhatsappAnsweringBotResolver } from '../../application/whatsapp-answering-bot.resolver';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WHATSAPP_DEVICE, WHATSAPP_MESSAGE_REPOSITORY } from '../../whatsapp.di-tokens';
import { ReactOnWhatsappCommand } from './react-on-whatsapp.command';

/**
 * Reacts to a message in a chat while the bot still answers it on a
 * connected number (`WhatsappAnsweringBotResolver`), as the number. Answers
 * whether WhatsApp took it: false for a chat the bot no longer answers, a
 * message no longer kept, or a host that did not send (offline, too old to
 * react, its budget spent), which is logged.
 */
@CommandHandler(ReactOnWhatsappCommand)
export class ReactOnWhatsappCommandHandler
  implements ICommandHandler<ReactOnWhatsappCommand, boolean>
{
  private readonly logger = new Logger(ReactOnWhatsappCommandHandler.name);

  constructor(
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    private readonly answering: WhatsappAnsweringBotResolver,
  ) {}

  async execute(command: ReactOnWhatsappCommand): Promise<boolean> {
    const answered = await this.answering.answering(command);
    if (!answered) return false;
    const { account } = answered;
    const message = await this.messages.findById(
      { organizationId: account.organizationId, accountId: account.id },
      command.messageRowId,
    );
    if (!message || message.chatId !== command.chatId) return false;
    const outcome = await this.device.react(
      account.hostId,
      command.chatId,
      { id: message.externalId, senderId: message.senderId },
      command.emoji,
    );
    if (outcome.kind === 'sent') return true;
    this.logger.warn({
      message: 'A WhatsApp reaction was not sent',
      accountId: account.id,
      outcome: outcome.kind,
      ...(outcome.kind === 'failed' ? { code: outcome.code } : {}),
    });
    return false;
  }
}
