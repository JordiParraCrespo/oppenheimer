import { randomUUID } from 'node:crypto';
import { type APIRequestContext, expect } from '@playwright/test';
import { FakeRunner, type Frame, type PairedHost } from './fake-runner';

export type { Frame } from './fake-runner';

/**
 * A runner on the link that holds a Telegram bot (`fake-runner.ts`), so a
 * spec can play Telegram's side: it says hello with the `telegram`
 * capability and then speaks only the Telegram frames of
 * `packages/shared/src/protocol/telegram.ts`. It answers `telegram.link` with `telegram.state`, every
 * `telegram.send` with `telegram.sent`, records every frame the control plane
 * sends, and hands over `telegram.messages` as the host's poller would.
 *
 * Message ids are one counter for the whole bot, inbound and sent alike,
 * because Telegram numbers a chat's messages in one sequence and the control
 * plane keys each by chat and id: a sent id equal to an inbound one would
 * read as the same message.
 */

/** One message the bot received, as `telegramInboundSchema` has it. */
export interface Inbound {
  key: string;
  id: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName?: string;
  senderId: string;
  senderName?: string;
  text: string;
  sentAt: string;
}

/** A Telegram user id nobody else's run will pick. */
export function telegramUserId(): string {
  return String(1_000_000_000 + Math.floor(Math.random() * 8_000_000_000));
}

/** How the fake answers `telegram.link`: with the bot connected, or not yet. */
export type LinkAnswer = 'connected' | 'connecting';

export class TelegramRunner extends FakeRunner {
  /** The bot this host holds, as `getMe` would report it. */
  readonly botId = telegramUserId();
  readonly username = `e2e_${randomUUID().slice(0, 8)}_bot`;
  linkAnswer: LinkAnswer = 'connected';
  private nextId = 100;

  private constructor(host: PairedHost) {
    super(host, 'telegram');
  }

  /**
   * Pair a host for the caller's workspace and hold its link. Pairing is
   * throttled per address, so a spec file pairs one and the test is slow.
   */
  static async pair(api: APIRequestContext, name: string): Promise<TelegramRunner> {
    const runner = new TelegramRunner(await FakeRunner.pairHost(api, name, 'e2e-telegram.local'));
    await runner.dial();
    return runner;
  }

  /** A fresh Telegram message id of this bot's, unique across its chats. */
  messageId(): string {
    this.nextId += 1;
    return String(this.nextId);
  }

  /** A direct message from `senderId`, in their chat with the bot. */
  direct(senderId: string, text: string, senderName = 'Ada'): Inbound {
    const id = this.messageId();
    return {
      key: `${senderId}:${id}`,
      id,
      chatId: senderId,
      chatKind: 'direct',
      chatName: senderName,
      senderId,
      senderName,
      text,
      sentAt: new Date().toISOString(),
    };
  }

  /** A message from `senderId` in a group the bot is in. */
  group(groupChatId: string, senderId: string, text: string): Inbound {
    const id = this.messageId();
    return {
      key: `${groupChatId}:${id}`,
      id,
      chatId: groupChatId,
      chatKind: 'group',
      chatName: 'The group',
      senderId,
      senderName: 'Ada',
      text,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Hand over messages as the poller does, and resolve with the keys of the
   * `telegram.ack` that names them: the control plane acks only what it stored.
   */
  async sendMessages(messages: Inbound[]): Promise<string[]> {
    return this.sendAndAwaitAck(
      { type: 'telegram.messages', messages },
      'telegram.ack',
      new Set(messages.map((message) => message.key)),
    );
  }

  /** The `telegram.send` frames to a chat, in the order they came. */
  sendsTo(chatId: string): Frame[] {
    return this.frames.filter((frame) => frame.type === 'telegram.send' && frame.chatId === chatId);
  }

  /** Wait for the `n`th `telegram.send` to a chat (1-based) and answer it. */
  async waitForSend(chatId: string, n = 1, timeout = 30_000): Promise<Frame> {
    await expect
      .poll(() => this.sendsTo(chatId).length, {
        message: `telegram.send #${n} to chat ${chatId}`,
        timeout,
      })
      .toBeGreaterThanOrEqual(n);
    return this.sendsTo(chatId)[n - 1] as Frame;
  }

  /** Wait for the `telegram.send` that replies to a message, and answer it. */
  async waitForReplyTo(message: Inbound, timeout = 30_000): Promise<Frame> {
    const replies = () =>
      this.sendsTo(message.chatId).filter((frame) => frame.replyToId === message.id);
    await expect
      .poll(() => replies().length, { message: `the reply to "${message.text}"`, timeout })
      .toBeGreaterThanOrEqual(1);
    return replies()[0] as Frame;
  }

  /** Report how the bot stands, as the runner does on every change. */
  reportState(state: 'connected' | 'connecting' | 'unlinked'): void {
    this.send({
      type: 'telegram.state',
      state,
      ...(state === 'connected'
        ? { botId: this.botId, username: this.username, name: 'E2E bot' }
        : {}),
    });
  }

  protected afterHello(): void {
    this.reportState('unlinked');
  }

  protected answer(frame: Frame): void {
    if (frame.type === 'telegram.link') {
      this.reportState(this.linkAnswer);
    } else if (frame.type === 'telegram.unlink') {
      this.reportState('unlinked');
    } else if (frame.type === 'telegram.send') {
      this.send({
        type: 'telegram.sent',
        commandId: frame.commandId,
        id: this.messageId(),
        sentAt: new Date().toISOString(),
      });
    }
  }
}
