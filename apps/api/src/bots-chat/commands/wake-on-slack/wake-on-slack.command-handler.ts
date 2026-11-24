import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { botTakesImages } from '@oppenheimer/shared';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { BotSlackImagesResolver } from '../../application/bot-slack-images.resolver';
import { slackOpeningText, slackTurn } from '../../domain/bot-slack-turn.policy';
import { WakeOnSlackCommand } from './wake-on-slack.command';

/**
 * The owner's message to their bot in Slack: a turn in the conversation that
 * is its thread (each thread one conversation, from its first message, so
 * nothing is "new" but a new thread), keyed by the message so a delivery twice
 * is one turn; `stop` asks the thread's running turn to stop
 * (`BotChannelWakeResolver`). The resolver wakes only a bot the owner made.
 * The images the message shared are fetched and stored then, for a bot whose
 * model reads images, and the turn sees them as a console message's; what it
 * cannot see is said in its words.
 */
@CommandHandler(WakeOnSlackCommand)
export class WakeOnSlackCommandHandler implements ICommandHandler<WakeOnSlackCommand, void> {
  constructor(
    private readonly channel: BotChannelWakeResolver,
    private readonly images: BotSlackImagesResolver,
  ) {}

  async execute(command: WakeOnSlackCommand): Promise<void> {
    const { organizationId, botId, slackAccountId, channel, chatId, ts } = command;
    await this.channel.wake({
      chat: { kind: 'slack', organizationId, botId, slackAccountId, chatId },
      userId: command.userId,
      startsAt: '0',
      messageId: command.position,
      command: command.command,
      correlationId: command.metadata.correlationId,
      turn: async (props, conversationId) => {
        const readsImages = botTakesImages(props.provider);
        const { stored, unread } = readsImages
          ? await this.images.store({
              organizationId,
              botId,
              slackAccountId,
              ownerUserId: command.userId,
              images: command.images,
            })
          : { stored: [], unread: command.images.length };
        const text = slackOpeningText(
          command.text,
          unread + command.skippedFiles,
          readsImages ? 'not_read' : 'model_reads_no_images',
        );
        return slackTurn(props, {
          conversationId,
          slackAccountId,
          channel,
          ts,
          text,
          attachments: stored,
        });
      },
    });
  }
}
