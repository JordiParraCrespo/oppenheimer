import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { isChannelOrigin } from '@oppenheimer/shared';
import { BotChannelReplyResolver } from '../../application/bot-channel-reply.resolver';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { channelReplyOf, sendsAsItGoes, unsentTexts } from '../../domain/bot-channel-turn.policy';
import { DeliverChannelReplyCommand } from './deliver-channel-reply.command';

/**
 * A channel turn's answer goes back to the chat it was asked in: its last
 * text not sent yet (a turn that sends as it goes has sent what it wrote
 * before its last tool calls), or what happened to it, as a reply to the
 * message that opened it (`BotChannelReplyResolver`). A turn that ended on
 * an approval card adds the bot's address in the console, where the card is
 * answered. The job is not retried, so an answer is not sent twice.
 */
@CommandHandler(DeliverChannelReplyCommand)
export class DeliverChannelReplyCommandHandler
  implements ICommandHandler<DeliverChannelReplyCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
    private readonly channel: BotChannelReplyResolver,
    private readonly config: ConfigService,
  ) {}

  async execute({ turnId, metadata }: DeliverChannelReplyCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (!isChannelOrigin(turn.origin) || !turn.ended) return;
    const lines = await this.messages.findTurnLines(turn.organizationId, turn.id);
    const text = channelReplyOf(
      turn,
      unsentTexts(lines, sendsAsItGoes(turn)),
      await this.waitingAt(turn),
    );
    await this.channel.send(turn, text, metadata.correlationId);
  }

  /** The bot's chat in the console, when the card waiting there is this turn's. */
  private async waitingAt(turn: {
    id: string;
    organizationId: string;
    botId: string;
  }): Promise<string | null> {
    const pending = await this.approvals.findPending(turn.organizationId, turn.botId);
    if (pending.isNone() || pending.unwrap().turnId !== turn.id) return null;
    const origin = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    return `${origin.replace(/\/+$/, '')}/bots/${turn.botId}`;
  }
}
