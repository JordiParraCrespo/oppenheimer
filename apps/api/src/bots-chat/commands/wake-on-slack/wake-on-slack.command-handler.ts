import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { slackTurn } from '../../domain/bot-slack-turn.policy';
import { WakeOnSlackCommand } from './wake-on-slack.command';

/**
 * The owner's message to their bot in Slack: a turn in the conversation that
 * is its thread (each thread one conversation, from its first message, so
 * nothing is "new" but a new thread), keyed by the message so a delivery twice
 * is one turn; `stop` asks the thread's running turn to stop
 * (`BotChannelWakeResolver`). The resolver wakes only a bot the owner made.
 */
@CommandHandler(WakeOnSlackCommand)
export class WakeOnSlackCommandHandler implements ICommandHandler<WakeOnSlackCommand, void> {
  constructor(private readonly channel: BotChannelWakeResolver) {}

  async execute(command: WakeOnSlackCommand): Promise<void> {
    const { organizationId, botId, slackAccountId, channel, chatId, ts } = command;
    await this.channel.wake({
      chat: { kind: 'slack', organizationId, botId, slackAccountId, chatId },
      userId: command.userId,
      startsAt: '0',
      messageId: command.position,
      command: command.command,
      correlationId: command.metadata.correlationId,
      turn: (props, conversationId) =>
        slackTurn(props, { conversationId, slackAccountId, channel, ts, text: command.text }),
    });
  }
}
