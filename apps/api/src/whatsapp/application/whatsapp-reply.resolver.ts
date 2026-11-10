import { Inject, Injectable, Logger } from '@nestjs/common';
import { splitReplyText } from '@oppenheimer/shared';
import { WHATSAPP_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';
import type { WhatsappMessageRepositoryPort } from '../database/whatsapp-message.repository.port';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import { WHATSAPP_DEVICE, WHATSAPP_MESSAGE_REPOSITORY } from '../whatsapp.di-tokens';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';
import type { WhatsappDevicePort, WhatsappQuote } from './whatsapp-device.port';

/** Where a reply goes: the owner's direct chat with the number, quoting their message. */
export interface WhatsappReplyTarget {
  chatId: string;
  /** The owner's message it answers, quoted above the first part; null to quote nothing. */
  quote: WhatsappQuote | null;
}

/**
 * Sends a reply in the owner's chat, not as a tool's send: a bot's answer to
 * the owner's own message (`botId`, recorded as a reply, so it is not one of
 * the bot's sends a day), or a fixed line (no bot). It is cut to WhatsApp's
 * length, quotes the owner's message on its first part, is paced by the
 * host's own budget, and is kept beside what the number received. It answers
 * how many parts went; a part the host did not send ends it there, logged,
 * since nobody is waiting on a request to be told.
 */
@Injectable()
export class WhatsappReplyResolver {
  private readonly logger = new Logger(WhatsappReplyResolver.name);

  constructor(
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    private readonly mapper: WhatsappMessageMapper,
  ) {}

  async send(
    account: WhatsappAccountEntity,
    target: WhatsappReplyTarget,
    text: string,
    botId: string | null,
  ): Promise<number> {
    let sentParts = 0;
    for (const [index, part] of splitReplyText(text, WHATSAPP_TEXT_MAX_CHARS).entries()) {
      const quote = index === 0 ? (target.quote ?? undefined) : undefined;
      const outcome = await this.device.send(account.hostId, target.chatId, part, quote);
      if (outcome.kind !== 'sent') {
        this.logger.warn({
          message: 'A WhatsApp reply was not sent',
          accountId: account.id,
          outcome: outcome.kind,
          ...(outcome.kind === 'failed' ? { code: outcome.code } : {}),
        });
        return sentParts;
      }
      await this.messages.recordBotSend(
        this.mapper.fromBotSend({
          account,
          chat: { chatId: target.chatId, chatKind: 'direct', chatName: null },
          text: part,
          sent: outcome,
          botId,
          isReply: true,
          quotedId: quote?.id ?? null,
        }),
      );
      sentParts += 1;
    }
    return sentParts;
  }
}
