import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSCRIPT_START_CONVERSATION,
  type TranscriptReadMessage,
} from '@oppenheimer/shared/protocol';
import type {
  HostTranscriptRequest,
  SessionTranscriptOutcome,
  SessionTranscriptPort,
} from '../../sessions/application/session-transcript.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a page may take. The runner reads at most a few megabytes of a
 * file it already knows and compacts it; past this the reader is told the
 * host did not answer rather than holding its request.
 */
export const TRANSCRIPT_READ_TIMEOUT_MS = 8_000;

/**
 * `SessionTranscriptPort` over the runner link: `transcript.read` with a
 * fresh `commandId`, then the `transcript.page` or `command.failed` that
 * names it, through `LinkRepliesPort`. Sent only to a runner whose hello
 * named `transcript.read`; an older one would log the frame as unknown and
 * never answer. A read from the start is sent the protocol's interim way,
 * `TRANSCRIPT_START_CONVERSATION`, until the wire has a field of its own.
 */
@Injectable()
export class RelaySessionTranscriptAdapter implements SessionTranscriptPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async read(
    hostId: string,
    sessionId: string,
    request: HostTranscriptRequest,
  ): Promise<SessionTranscriptOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('transcript.read')) return { kind: 'not_supported' };

    const fromStart = 'from' in request;
    const message: TranscriptReadMessage = {
      type: 'transcript.read',
      commandId: randomUUID(),
      sessionId,
      ...(fromStart
        ? { limit: request.limit, conversation: TRANSCRIPT_START_CONVERSATION, after: 0 }
        : request),
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, TRANSCRIPT_READ_TIMEOUT_MS);
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
    if (reply.type !== 'transcript.page') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...page } = reply;
    // The start is asked for as a conversation the host does not have, which
    // it answers as a stale cursor (`restarted`); that flag is this read's own
    // doing, not news, so it ends here, beside the sentinel that caused it.
    return { kind: 'page', page: fromStart ? { ...page, restarted: false } : page };
  }
}
