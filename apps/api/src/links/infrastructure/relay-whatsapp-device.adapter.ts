import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_VOICE_NOTE_MAX_BYTES,
  type WhatsappMediaGetKind,
  type WhatsappMediaGetMessage,
  type WhatsappSendMessage,
  type WhatsappSendVoiceMessage,
} from '@oppenheimer/shared/protocol';
import type {
  WhatsappDevicePort,
  WhatsappDeviceReach,
  WhatsappMediaOutcome,
  WhatsappQuote,
  WhatsappSendOutcome,
  WhatsappVoiceNoteOutcome,
} from '../../whatsapp/application/whatsapp-device.port';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a send may take. The runner spaces its sends and WhatsApp answers
 * in about a second; past this the bot is told the host did not answer, and
 * that the message may still have gone.
 */
export const WHATSAPP_SEND_TIMEOUT_MS = 20_000;

/**
 * How long a voice note or an image may take: the runner downloads it from
 * WhatsApp's media servers (and scales an image down), and gives up itself at
 * 40 seconds.
 */
export const WHATSAPP_VOICE_NOTE_TIMEOUT_MS = 45_000;

/**
 * How long a voice note may take: the runner uploads it to WhatsApp's media
 * servers, then sends it, and gives up itself at 40 seconds.
 */
export const WHATSAPP_VOICE_SEND_TIMEOUT_MS = 45_000;

/**
 * `WhatsappDevicePort` over the runner link. Sent only to a runner whose hello
 * named `whatsapp`; an older one would log the frame as unknown and never
 * answer. Pairing and unpairing are answered by the host's `whatsapp.state`,
 * so only a send waits, through `LinkRepliesPort`.
 */
@Injectable()
export class RelayWhatsappDeviceAdapter implements WhatsappDevicePort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  reach(hostId: string): WhatsappDeviceReach {
    const link = this.links.find(hostId);
    if (!link) return 'offline';
    return link.capabilities.includes('whatsapp') ? 'online' : 'unsupported';
  }

  link(hostId: string): boolean {
    return this.command(hostId, 'whatsapp.link');
  }

  unlink(hostId: string): boolean {
    return this.command(hostId, 'whatsapp.unlink');
  }

  async send(
    hostId: string,
    chatId: string,
    text: string,
    replyTo?: WhatsappQuote,
  ): Promise<WhatsappSendOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('whatsapp')) return { kind: 'not_supported' };
    const message: WhatsappSendMessage = {
      type: 'whatsapp.send',
      commandId: randomUUID(),
      chatId,
      text,
      ...(replyTo ? { replyTo: { id: replyTo.id, senderId: replyTo.senderId } } : {}),
    };
    return this.sent(hostId, link, message, WHATSAPP_SEND_TIMEOUT_MS);
  }

  async sendVoice(
    hostId: string,
    chatId: string,
    audio: Buffer,
    seconds: number,
  ): Promise<WhatsappSendOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('whatsapp.voice.send')) return { kind: 'not_supported' };
    // The runner reads the link with a frame cap: a larger frame would close
    // the link, every session on it included, before WA_006 could answer.
    if (audio.length > WHATSAPP_VOICE_NOTE_MAX_BYTES) {
      return { kind: 'failed', code: 'WA_006', detail: `${audio.length} bytes is past one frame` };
    }
    const message: WhatsappSendVoiceMessage = {
      type: 'whatsapp.send.voice',
      commandId: randomUUID(),
      chatId,
      mimetype: 'audio/ogg; codecs=opus',
      data: audio.toString('base64'),
      seconds,
    };
    return this.sent(hostId, link, message, WHATSAPP_VOICE_SEND_TIMEOUT_MS);
  }

  /** A send on the link, waited for: the host's `whatsapp.sent`, or why not. */
  private async sent(
    hostId: string,
    link: RunnerLink,
    message: WhatsappSendMessage | WhatsappSendVoiceMessage,
    timeoutMs: number,
  ): Promise<WhatsappSendOutcome> {
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, timeoutMs);
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
    if (reply.type !== 'whatsapp.sent') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'sent', id: reply.id, sentAt: new Date(reply.sentAt) };
  }

  voiceNote(hostId: string, chatId: string, messageId: string): Promise<WhatsappVoiceNoteOutcome> {
    return this.media(hostId, chatId, messageId, 'voice');
  }

  image(hostId: string, chatId: string, messageId: string): Promise<WhatsappMediaOutcome> {
    return this.media(hostId, chatId, messageId, 'image');
  }

  /**
   * One `whatsapp.media.get`, waited for. A voice note is asked without a
   * `kind`, as a runner from before images reads it; an image only of a
   * runner that names `whatsapp.image`.
   */
  private async media(
    hostId: string,
    chatId: string,
    messageId: string,
    kind: WhatsappMediaGetKind,
  ): Promise<WhatsappMediaOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    const capability = kind === 'image' ? 'whatsapp.image' : 'whatsapp.voice';
    if (!link.capabilities.includes(capability)) return { kind: 'not_supported' };
    const message: WhatsappMediaGetMessage = {
      type: 'whatsapp.media.get',
      commandId: randomUUID(),
      chatId,
      messageId,
      ...(kind === 'image' ? { kind } : {}),
    };
    const pending = this.replies.expect(hostId, message.commandId, WHATSAPP_VOICE_NOTE_TIMEOUT_MS);
    if (!link.send(message)) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    if (reply.type !== 'whatsapp.media') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'fetched', data: Buffer.from(reply.data, 'base64'), mimetype: reply.mimetype };
  }

  private command(hostId: string, type: 'whatsapp.link' | 'whatsapp.unlink'): boolean {
    const link = this.links.find(hostId);
    if (!link?.capabilities.includes('whatsapp')) return false;
    return link.send({ type, commandId: randomUUID() });
  }
}
