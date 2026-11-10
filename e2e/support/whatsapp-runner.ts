import { randomBytes } from 'node:crypto';
import { type APIRequestContext, expect } from '@playwright/test';
import { FakeRunner, type Frame, type PairedHost } from './fake-runner';

/**
 * A runner on the link that holds a WhatsApp linked device (`fake-runner.ts`),
 * so a spec can play WhatsApp's side: it says hello with the `whatsapp`
 * capability and then speaks only the WhatsApp frames of
 * `packages/shared/src/protocol/whatsapp.ts`. It answers `whatsapp.link` with
 * `whatsapp.state` connected (no QR to scan: the phone is imaginary), every
 * `whatsapp.send` with `whatsapp.sent`, records every frame the control plane
 * sends (with each send's `chatId`, `text` and `replyTo`), and hands over
 * `whatsapp.messages` as the host's outbox would.
 */

/** One message the number received or sent, as `whatsappInboundSchema` has it. */
export interface WhatsappInbound {
  key: string;
  id: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName?: string;
  senderId: string;
  senderName?: string;
  fromMe: boolean;
  text: string;
  sentAt: string;
}

/** A phone number nobody else's run will pick, as `+digits`. */
export function whatsappNumber(): string {
  return `+346${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`;
}

/** `+34600111222` → `34600111222@s.whatsapp.net`, the JID WhatsApp gives that number. */
export function jidOf(number: string): string {
  return `${number.replace(/\D/g, '')}@s.whatsapp.net`;
}

/** A WhatsApp message id: random hex, as WhatsApp's are random strings. */
function messageId(): string {
  return `3EB0${randomBytes(8).toString('hex').toUpperCase()}`;
}

export class WhatsappRunner extends FakeRunner {
  /** The spare number this host's device is paired as. */
  readonly number = whatsappNumber();
  readonly phone = jidOf(this.number);

  private constructor(host: PairedHost) {
    super(host, 'whatsapp');
  }

  /** Pair a host for the caller's workspace and hold its link (one per spec file). */
  static async pair(api: APIRequestContext, name: string): Promise<WhatsappRunner> {
    const runner = new WhatsappRunner(await FakeRunner.pairHost(api, name, 'e2e-whatsapp.local'));
    await runner.dial();
    return runner;
  }

  /**
   * A message in the direct chat with `from`'s number. `fromMe` is one the
   * spare number itself sent there (typed on its phone, or a bot's send).
   */
  direct(from: string, text: string, options: { fromMe?: boolean } = {}): WhatsappInbound {
    const fromMe = options.fromMe ?? false;
    return this.message({
      chatId: from,
      chatKind: 'direct',
      chatName: 'Ada',
      senderId: fromMe ? this.phone : from,
      fromMe,
      text,
    });
  }

  /** A message from `senderId` in a group the number is in. */
  group(groupId: string, senderId: string, text: string): WhatsappInbound {
    return this.message({
      chatId: groupId,
      chatKind: 'group',
      chatName: 'The group',
      senderId,
      fromMe: false,
      text,
    });
  }

  /** A note the number wrote in its chat with itself. */
  selfChat(text: string): WhatsappInbound {
    return this.message({
      chatId: this.phone,
      chatKind: 'direct',
      senderId: this.phone,
      fromMe: true,
      text,
    });
  }

  /**
   * Hand over messages as the host's outbox does, and resolve with the keys
   * of the `whatsapp.ack` that names them: the control plane acks only what
   * it stored.
   */
  async deliver(messages: WhatsappInbound[]): Promise<string[]> {
    return this.sendAndAwaitAck(
      { type: 'whatsapp.messages', messages },
      'whatsapp.ack',
      new Set(messages.map((message) => message.key)),
    );
  }

  /** Every `whatsapp.send`, or those to one chat, in the order they came. */
  sends(chatId?: string): Frame[] {
    return this.frames.filter(
      (frame) =>
        frame.type === 'whatsapp.send' && (chatId === undefined || frame.chatId === chatId),
    );
  }

  /** Wait for the `n`th `whatsapp.send` to a chat (1-based). */
  async waitForSend(chatId: string, n = 1, timeout = 30_000): Promise<Frame> {
    await expect
      .poll(() => this.sends(chatId).length, {
        message: `whatsapp.send #${n} to ${chatId}`,
        timeout,
      })
      .toBeGreaterThanOrEqual(n);
    return this.sends(chatId)[n - 1] as Frame;
  }

  /** The `whatsapp.send` frames that quote a message. */
  repliesTo(message: WhatsappInbound): Frame[] {
    return this.sends(message.chatId).filter(
      (frame) => (frame.replyTo as { id?: string } | undefined)?.id === message.id,
    );
  }

  /** Wait for the `whatsapp.send` that quotes a message. */
  async waitForReplyTo(message: WhatsappInbound, timeout = 30_000): Promise<Frame> {
    await expect
      .poll(() => this.repliesTo(message).length, {
        message: `the reply to "${message.text}"`,
        timeout,
      })
      .toBeGreaterThanOrEqual(1);
    return this.repliesTo(message)[0] as Frame;
  }

  /** Report how the device stands, as the runner does on every change. */
  reportState(state: 'connected' | 'unlinked'): void {
    this.send({
      type: 'whatsapp.state',
      state,
      ...(state === 'connected' ? { phone: this.phone, name: 'E2E spare' } : {}),
    });
  }

  protected afterHello(): void {
    this.reportState('unlinked');
  }

  protected answer(frame: Frame): void {
    if (frame.type === 'whatsapp.link') {
      this.reportState('connected');
    } else if (frame.type === 'whatsapp.unlink') {
      this.reportState('unlinked');
    } else if (frame.type === 'whatsapp.send') {
      this.send({
        type: 'whatsapp.sent',
        commandId: frame.commandId,
        id: messageId(),
        sentAt: new Date().toISOString(),
      });
    }
  }

  private message(fields: Omit<WhatsappInbound, 'key' | 'id' | 'sentAt'>): WhatsappInbound {
    const id = messageId();
    return { ...fields, key: `${fields.chatId}:${id}`, id, sentAt: new Date().toISOString() };
  }
}
