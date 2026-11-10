import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappOwnerWroteDomainEvent } from '../../../whatsapp/domain/events/whatsapp-owner-wrote.domain-event';
import { WakeOnWhatsappCommand } from '../../commands/wake-on-whatsapp/wake-on-whatsapp.command';

/**
 * Where the confirmed owner's message to their linked number reaches the
 * Oppenheimer bot that answers the chat
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): one wake per
 * stored message, which the wake keys by its row, so a delivery twice queues
 * one turn.
 */
@Injectable()
export class BotWhatsappWakeDomainEventHandler {
  constructor(private readonly commands: CommandBus) {}

  // `suppressErrors: false`: a wake that failed is delivered again by the outbox.
  @OnEvent(WhatsappOwnerWroteDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      WhatsappOwnerWroteDomainEvent,
      | 'organizationId'
      | 'userId'
      | 'accountId'
      | 'chatId'
      | 'messageRowId'
      | 'seq'
      | 'botId'
      | 'conversationStartsAt'
      | 'command'
      | 'text'
      | 'metadata'
    >,
  ): Promise<void> {
    await this.commands.execute(
      new WakeOnWhatsappCommand({
        organizationId: event.organizationId,
        userId: event.userId,
        botId: event.botId,
        whatsappAccountId: event.accountId,
        chatId: event.chatId,
        messageRowId: event.messageRowId,
        seq: event.seq,
        conversationStartsAt: event.conversationStartsAt,
        command: event.command,
        text: event.text,
        metadata: { correlationId: event.metadata?.correlationId ?? undefined },
      }),
    );
  }
}
