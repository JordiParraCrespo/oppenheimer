import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { WHATSAPP_SENDS_PER_DAY } from '@oppenheimer/shared';
import type {
  WhatsappDevicePort,
  WhatsappSendOutcome,
} from '../../application/whatsapp-device.port';
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
 * Sends a bot's message from one of its owner's numbers (`whatsapp.md` §4):
 * only while the device is connected and under the day's share, through the
 * host's runner, which keeps a budget of its own. What went is kept beside
 * what the number received, marked as the bot's, so the chat reads whole and
 * the day's sends can be counted. Answers WhatsApp's id for the message.
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

    const sent = sentOrThrow(
      await this.device.send(account.hostId, command.chat.chatId, command.text),
    );
    await this.messages.recordBotSend(
      this.mapper.fromBotSend({
        account,
        chat: command.chat,
        text: command.text,
        sent,
        botId: command.botId,
      }),
    );
    return sent.id;
  }
}

/** The host's answer, or the problem a bot is told. */
function sentOrThrow(outcome: WhatsappSendOutcome): { id: string; sentAt: Date } {
  switch (outcome.kind) {
    case 'sent':
      return outcome;
    case 'host_offline':
      throw new AppError(WhatsappErrors.HOST_OFFLINE);
    case 'not_supported':
      throw new AppError(WhatsappErrors.HOST_UNSUPPORTED);
    case 'timed_out':
      throw new AppError(WhatsappErrors.SEND_FAILED, {
        detail: 'The host did not answer in time; the message may still have gone.',
      });
    case 'failed':
      if (outcome.code === 'WA_002') throw new AppError(WhatsappErrors.NOT_CONNECTED);
      if (outcome.code === 'WA_004') {
        throw new AppError(WhatsappErrors.SEND_LIMIT_REACHED, {
          detail: 'The host’s own send budget is spent.',
        });
      }
      throw new AppError(WhatsappErrors.SEND_FAILED, {
        detail: outcome.detail ?? outcome.code,
        extensions: { upstreamCode: outcome.code },
      });
  }
}
