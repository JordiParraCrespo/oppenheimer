import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { TelegramLinkMessage, TelegramSendMessage } from '@oppenheimer/shared/protocol';
import type {
  TelegramDevicePort,
  TelegramDeviceReach,
  TelegramLinkAttempt,
  TelegramSendOutcome,
} from '../../telegram/application/telegram-device.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a send may take. The runner paces sends to Telegram's limits (one a
 * second to a chat) and Telegram answers in well under a second; past this
 * the bot is told the host did not answer, and that the message may still
 * have gone.
 */
export const TELEGRAM_SEND_TIMEOUT_MS = 20_000;

/**
 * How long a connect waits for the host to refuse the token. The host checks
 * it with one `getMe`; a token it took is answered by `telegram.state`, so
 * this only bounds how long a refusal is listened for.
 */
export const TELEGRAM_LINK_REFUSAL_WINDOW_MS = 30_000;

/**
 * `TelegramDevicePort` over the runner link. Sent only to a runner whose hello
 * named `telegram`; an older one would log the frame as unknown and never
 * answer. The `telegram.link` frame carries the bot's token, which crosses
 * here once and is never kept or logged. A connect is answered by the host's
 * `telegram.state` (or a refusal, listened for through `LinkRepliesPort`),
 * a disconnect by the state alone, and a send waits for its reply.
 */
@Injectable()
export class RelayTelegramDeviceAdapter implements TelegramDevicePort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  reach(hostId: string): TelegramDeviceReach {
    const link = this.links.find(hostId);
    if (!link) return 'offline';
    return link.capabilities.includes('telegram') ? 'online' : 'unsupported';
  }

  link(hostId: string, token: string): TelegramLinkAttempt {
    const link = this.links.find(hostId);
    if (!link?.capabilities.includes('telegram')) {
      return { sent: false, refused: Promise.resolve(null) };
    }
    const message: TelegramLinkMessage = { type: 'telegram.link', commandId: randomUUID(), token };
    const pending = this.replies.expect(hostId, message.commandId, TELEGRAM_LINK_REFUSAL_WINDOW_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { sent: false, refused: Promise.resolve(null) };
    }
    return {
      sent: true,
      refused: pending.reply.then((reply) =>
        reply?.type === 'command.failed' ? { code: reply.code, detail: reply.detail } : null,
      ),
    };
  }

  unlink(hostId: string): boolean {
    const link = this.links.find(hostId);
    if (!link?.capabilities.includes('telegram')) return false;
    return link.send({ type: 'telegram.unlink', commandId: randomUUID() });
  }

  async send(
    hostId: string,
    chatId: string,
    text: string,
    replyToId?: string,
  ): Promise<TelegramSendOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('telegram')) return { kind: 'not_supported' };
    const message: TelegramSendMessage = {
      type: 'telegram.send',
      commandId: randomUUID(),
      chatId,
      text,
      ...(replyToId ? { replyToId } : {}),
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, TELEGRAM_SEND_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    // A reply is matched by command id, so another kind is a runner bug.
    if (reply.type !== 'telegram.sent') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'sent', id: reply.id, sentAt: new Date(reply.sentAt) };
  }
}
