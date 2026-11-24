import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { SlackOwnerWroteDomainEvent } from '../../../slack/domain/events/slack-owner-wrote.domain-event';
import { WakeOnSlackCommand } from '../../commands/wake-on-slack/wake-on-slack.command';

/**
 * Where the owner's message to their bot in Slack reaches the bot: one wake
 * per delivered message, which the wake keys, so a delivery twice queues one turn.
 */
@Injectable()
export class BotSlackWakeDomainEventHandler {
  constructor(private readonly commands: CommandBus) {}

  // `suppressErrors: false`: a wake that failed is delivered again by the outbox.
  @OnEvent(SlackOwnerWroteDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      SlackOwnerWroteDomainEvent,
      | 'aggregateId'
      | 'organizationId'
      | 'userId'
      | 'botId'
      | 'channel'
      | 'chatId'
      | 'ts'
      | 'position'
      | 'command'
      | 'text'
      | 'metadata'
    > &
      // An event staged before images were read carries neither.
      Partial<Pick<SlackOwnerWroteDomainEvent, 'images' | 'skippedFiles'>>,
  ): Promise<void> {
    await this.commands.execute(
      new WakeOnSlackCommand({
        organizationId: event.organizationId,
        userId: event.userId,
        botId: event.botId,
        slackAccountId: event.aggregateId,
        channel: event.channel,
        chatId: event.chatId,
        ts: event.ts,
        position: event.position,
        command: event.command,
        text: event.text,
        images: event.images ?? [],
        skippedFiles: event.skippedFiles ?? 0,
        metadata: { correlationId: event.metadata?.correlationId ?? undefined },
      }),
    );
  }
}
