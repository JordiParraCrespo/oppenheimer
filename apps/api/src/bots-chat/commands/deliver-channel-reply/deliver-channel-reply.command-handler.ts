import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { isChannelOrigin } from '@oppenheimer/shared';
import { BotChannelReplyResolver } from '../../application/bot-channel-reply.resolver';
import { BOT_MESSAGE_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { channelReplyOf, sendsAsItGoes, unsentTexts } from '../../domain/bot-channel-turn.policy';
import { DeliverChannelReplyCommand } from './deliver-channel-reply.command';

/**
 * A channel turn's answer goes back to the chat it was asked in: its last
 * text not sent yet (a turn that sends as it goes has sent what it wrote
 * before its last tool calls), or what happened to it, as a reply to the
 * message that opened it (`BotChannelReplyResolver`). The job is not
 * retried, so an answer is not sent twice.
 */
@CommandHandler(DeliverChannelReplyCommand)
export class DeliverChannelReplyCommandHandler
  implements ICommandHandler<DeliverChannelReplyCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly channel: BotChannelReplyResolver,
  ) {}

  async execute({ turnId, metadata }: DeliverChannelReplyCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (!isChannelOrigin(turn.origin) || !turn.ended) return;
    const lines = await this.messages.findTurnLines(turn.organizationId, turn.id);
    const text = channelReplyOf(turn, unsentTexts(lines, sendsAsItGoes(turn)));
    await this.channel.send(turn, text, metadata.correlationId);
  }
}
