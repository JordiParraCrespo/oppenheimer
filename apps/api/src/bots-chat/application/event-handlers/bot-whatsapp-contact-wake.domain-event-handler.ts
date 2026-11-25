import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappContactWroteDomainEvent } from '../../../whatsapp/domain/events/whatsapp-contact-wrote.domain-event';
import { WakeOnWhatsappContactCommand } from '../../commands/wake-on-whatsapp-contact/wake-on-whatsapp-contact.command';

/**
 * Where a contact's message in a chat a linked number allows reaches the bot
 * that answers that chat: one wake per stored message, which the wake keys by
 * its row, so a delivery twice queues one turn.
 */
@Injectable()
export class BotWhatsappContactWakeDomainEventHandler {
  constructor(private readonly commands: CommandBus) {}

  // `suppressErrors: false`: a wake that failed is delivered again by the outbox.
  @OnEvent(WhatsappContactWroteDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      WhatsappContactWroteDomainEvent,
      | 'organizationId'
      | 'userId'
      | 'accountId'
      | 'chatId'
      | 'chatKind'
      | 'chatName'
      | 'senderId'
      | 'senderName'
      | 'messageRowId'
      | 'seq'
      | 'botId'
      | 'text'
      | 'image'
      | 'metadata'
    >,
  ): Promise<void> {
    await this.commands.execute(
      new WakeOnWhatsappContactCommand({
        organizationId: event.organizationId,
        userId: event.userId,
        botId: event.botId,
        whatsappAccountId: event.accountId,
        chatId: event.chatId,
        chatKind: event.chatKind,
        chatName: event.chatName,
        senderId: event.senderId,
        senderName: event.senderName,
        messageRowId: event.messageRowId,
        seq: event.seq,
        text: event.text,
        // Absent on an event staged before images were seen.
        image: event.image ?? false,
        metadata: { correlationId: event.metadata?.correlationId ?? undefined },
      }),
    );
  }
}
