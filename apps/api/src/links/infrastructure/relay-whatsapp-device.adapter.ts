import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { WhatsappSendMessage } from '@oppenheimer/shared/protocol';
import type {
  WhatsappDevicePort,
  WhatsappDeviceReach,
  WhatsappSendOutcome,
} from '../../whatsapp/application/whatsapp-device.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a send may take. The runner spaces its sends and WhatsApp answers
 * in about a second; past this the bot is told the host did not answer, and
 * that the message may still have gone.
 */
export const WHATSAPP_SEND_TIMEOUT_MS = 20_000;

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

  async send(hostId: string, chatId: string, text: string): Promise<WhatsappSendOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('whatsapp')) return { kind: 'not_supported' };
    const message: WhatsappSendMessage = {
      type: 'whatsapp.send',
      commandId: randomUUID(),
      chatId,
      text,
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, WHATSAPP_SEND_TIMEOUT_MS);
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

  private command(hostId: string, type: 'whatsapp.link' | 'whatsapp.unlink'): boolean {
    const link = this.links.find(hostId);
    if (!link?.capabilities.includes('whatsapp')) return false;
    return link.send({ type, commandId: randomUUID() });
  }
}
