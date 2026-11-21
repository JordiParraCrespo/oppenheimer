import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { WHATSAPP_SENDS_PER_DAY } from '@oppenheimer/shared';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import { whatsappSentOrThrow } from '../../application/whatsapp-send-outcome.policy';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { whatsappSendRefusal } from '../../domain/whatsapp-send.policy';
import {
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_DEVICE,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { WhatsappMessageMapper } from '../../whatsapp-message.mapper';
import { SendWhatsappMessageCommand } from './send-whatsapp-message.command';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a bot's message from one of its owner's numbers: only while the device
 * is connected and under the day's share, through the host's runner, which
 * keeps a budget of its own. What went is kept beside what the number received,
 * marked as the bot's, so the chat reads whole and the day's sends can be
 * counted; a voice note is kept as one, with the text it spoke as its
 * transcript and never its audio. Answers WhatsApp's id for the message.
 */
@CommandHandler(SendWhatsappMessageCommand)
export class SendWhatsappMessageCommandHandler
  implements ICommandHandler<SendWhatsappMessageCommand, string>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    private readonly mapper: WhatsappMessageMapper,
  ) {}

  async execute(command: SendWhatsappMessageCommand): Promise<string> {
    const found = await this.accounts.findOwnById(command.scope, command.accountId);
    if (found.isNone()) throw new AppError(WhatsappErrors.ACCOUNT_NOT_FOUND);
    const account = found.unwrap();
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const sentToday = await this.messages.countBotSendsSince(ref, new Date(Date.now() - DAY_MS));
    const refusal = whatsappSendRefusal(account.status, sentToday, WHATSAPP_SENDS_PER_DAY);
    if (refusal === 'not_connected') {
      throw new AppError(WhatsappErrors.NOT_CONNECTED, {
        detail: `The number is ${account.status}.`,
      });
    }
    if (refusal === 'limit_reached') {
      throw new AppError(WhatsappErrors.SEND_LIMIT_REACHED, {
        detail: `Bots sent ${sentToday} messages from it in the last day; ${WHATSAPP_SENDS_PER_DAY} is the most.`,
      });
    }

    const sent = await this.deliver(account.hostId, command);
    await this.messages.recordBotSend(
      this.mapper.fromBotSend({
        account,
        chat: command.chat,
        text: command.text,
        sent,
        botId: command.botId,
        voiceSeconds: command.voice?.seconds,
      }),
    );
    return sent.id;
  }

  /**
   * The message on the host: a text, or a voice note, and what came of it.
   * Audio too large for one link frame is the link adapter's to refuse
   * (`WA_006`), before it could close the link.
   */
  private async deliver(
    hostId: string,
    { chat, text, voice }: SendWhatsappMessageCommand,
  ): Promise<{ id: string; sentAt: Date }> {
    if (!voice) return whatsappSentOrThrow(await this.device.send(hostId, chat.chatId, text));
    const outcome = await this.device.sendVoice(hostId, chat.chatId, voice.audio, voice.seconds);
    if (outcome.kind === 'not_supported') {
      throw new AppError(WhatsappErrors.HOST_UNSUPPORTED, {
        detail: 'The host’s runner predates sending voice notes; updating it fixes this.',
      });
    }
    return whatsappSentOrThrow(outcome);
  }
}
