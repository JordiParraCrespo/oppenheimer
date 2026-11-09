import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { TelegramOwnerWroteDomainEvent } from '../../../telegram/domain/events/telegram-owner-wrote.domain-event';
import { WakeOnTelegramCommand } from '../../commands/wake-on-telegram/wake-on-telegram.command';

/**
 * Where the owner's message to their Telegram bot reaches the Oppenheimer
 * bot that answers there
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): one wake per
 * stored message, which the wake keys, so a delivery twice queues one turn.
 */
@Injectable()
export class BotTelegramWakeDomainEventHandler {
  constructor(private readonly commands: CommandBus) {}

  // `suppressErrors: false`: a wake that failed is delivered again by the outbox.
  @OnEvent(TelegramOwnerWroteDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      TelegramOwnerWroteDomainEvent,
      | 'aggregateId'
      | 'organizationId'
      | 'userId'
      | 'answeringBotId'
      | 'chatId'
      | 'messageId'
      | 'command'
      | 'text'
      | 'metadata'
    >,
  ): Promise<void> {
    await this.commands.execute(
      new WakeOnTelegramCommand({
        organizationId: event.organizationId,
        userId: event.userId,
        botId: event.answeringBotId,
        telegramAccountId: event.aggregateId,
        chatId: event.chatId,
        messageId: event.messageId,
        command: event.command,
        text: event.text,
        metadata: { correlationId: event.metadata?.correlationId ?? undefined },
      }),
    );
  }
}
