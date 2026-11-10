import { createHash, generateKeyPairSync, type KeyObject, randomUUID, sign } from 'node:crypto';
import { type APIRequestContext, expect } from '@playwright/test';
import { API_URL } from '../playwright.config';
import { newContext } from './auth';
import { mintPairingToken, registerHost } from './sessions';

/**
 * A runner on the link that holds a Telegram bot, written in TypeScript so a
 * spec can play Telegram's side: it pairs through the real mint-and-redeem
 * flow, dials `/api/v1/relay/runner` with a signed boot assertion, says hello
 * with the `telegram` capability, and then speaks only the Telegram frames of
 * `packages/shared/src/protocol/telegram.ts`.
 *
 * A real runner cannot stand here: its Bot API client is fixed to
 * api.telegram.org, and pointing it elsewhere would be a test-only seam. So
 * this one answers `telegram.link` with `telegram.state`, every
 * `telegram.send` with `telegram.sent`, records every frame the control plane
 * sends, and hands over `telegram.messages` as the host's poller would.
 *
 * Message ids are one counter for the whole bot, inbound and sent alike,
 * because Telegram numbers a chat's messages in one sequence and the control
 * plane keys each by chat and id: a sent id equal to an inbound one would
 * read as the same message.
 */

/** `apps/runner/internal/host/domain.Facts` as Go marshals it. */
const FACTS = {
  platform: 'debian',
  osVersion: '13',
  arch: 'amd64',
  hostname: 'e2e-telegram.local',
  user: 'runner',
  home: '/home/runner',
  root: false,
  tools: [
    { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
    { name: 'tmux', path: '/usr/bin/tmux', version: '3.5a', required: true },
  ],
  workspacePath: '/home/runner/oppenheimer-ai',
  diskFreeBytes: 53_687_091_200,
  runnerVersion: '0.9.0',
};

/** A frame the control plane sent, as JSON. */
export type Frame = { type: string; [key: string]: unknown };

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

function hostKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return { privateKey, base64: raw.toString('base64') };
}

/** The short-lived boot assertion the runner signs on every dial (`hosts.spec.ts`). */
function bootAssertion(privateKey: KeyObject, hostId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: hostId,
      sub: hostId,
      aud: API_URL,
      jti: createHash('sha256').update(`${hostId}:${Math.random()}`).digest('hex').slice(0, 32),
      iat: now,
      exp: now + 300,
    }),
  ).toString('base64url');
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

/** How the fake answers `telegram.link`: with the bot connected, or not yet. */
export type LinkAnswer = 'connected' | 'connecting';

export class TelegramRunner {
  /** Every frame the control plane sent, in order. */
  readonly frames: Frame[] = [];
  /** The bot this host holds, as `getMe` would report it. */
  readonly botId = telegramUserId();
  readonly username = `e2e_${randomUUID().slice(0, 8)}_bot`;
  linkAnswer: LinkAnswer = 'connected';
  private nextId = 100;
  private socket: WebSocket | null = null;

  private constructor(
    readonly hostId: string,
    private readonly privateKey: KeyObject,
  ) {}

  /**
   * Pair a host for the caller's workspace and hold its link. Pairing is
   * throttled per address, so a spec file pairs one and the test is slow.
   */
  static async pair(api: APIRequestContext, name: string): Promise<TelegramRunner> {
    const secret = await mintPairingToken(api, name);
    const key = hostKey();
    const anonymous = await newContext();
    const registered = await registerHost(anonymous, {
      token: secret,
      name,
      publicKey: key.base64,
      facts: FACTS,
    });
    expect(registered.status(), await registered.text()).toBe(201);
    const { hostId } = (await registered.json()) as { hostId: string };
    await anonymous.dispose();
    const runner = new TelegramRunner(hostId, key.privateKey);
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
    const from = this.frames.length;
    this.send({ type: 'telegram.messages', messages });
    const keys = new Set(messages.map((message) => message.key));
    let acked: string[] = [];
    await expect
      .poll(
        () => {
          const ack = this.frames
            .slice(from)
            .find(
              (frame) =>
                frame.type === 'telegram.ack' &&
                (frame.keys as string[]).some((key) => keys.has(key)),
            );
          acked = (ack?.keys as string[] | undefined) ?? [];
          return acked.length > 0;
        },
        { message: 'telegram.ack for the batch', timeout: 15_000 },
      )
      .toBe(true);
    return acked;
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

  /** Whether a frame of this type arrived since `from`. */
  received(type: string, from = 0): boolean {
    return this.frames.slice(from).some((frame) => frame.type === type);
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

  close(): void {
    this.socket?.close(1000, 'test over');
    this.socket = null;
  }

  private send(frame: Record<string, unknown>): void {
    if (!this.socket) throw new Error('the fake runner has no link');
    this.socket.send(JSON.stringify(frame));
  }

  private async dial(): Promise<void> {
    const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/v1/relay/runner`, {
      // Undici's extension: the runner presents its boot assertion as a bearer.
      headers: { authorization: `Bearer ${bootAssertion(this.privateKey, this.hostId)}` },
    } as unknown as string[]);
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const frame = JSON.parse(event.data) as Frame;
      this.frames.push(frame);
      this.answer(frame);
    });
    await new Promise<void>((ok, fail) => {
      socket.addEventListener('open', () => ok(), { once: true });
      socket.addEventListener('error', () => fail(new Error('runner link refused')), {
        once: true,
      });
    });
    this.send({
      type: 'hello',
      runnerVersion: FACTS.runnerVersion,
      protocol: { min: 1, max: 1 },
      runId: randomUUID(),
      host: FACTS,
      sessions: [],
      capabilities: ['telegram'],
    });
    this.reportState('unlinked');
  }

  private answer(frame: Frame): void {
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
