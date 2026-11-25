import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionChangesScope } from '@oppenheimer/shared/protocol';
import type {
  SessionChangesOutcome,
  SessionChangesPort,
} from '../../sessions/application/session-changes.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a read of a session's changes may take: git over each checkout,
 * which on a store fetched without its blobs fetches them as the diff reads
 * them. The runner stops reading patches at 12s and answers with what it
 * has; past this the Review says the host did not answer.
 */
export const SESSION_CHANGES_TIMEOUT_MS = 15_000;

/**
 * `SessionChangesPort` over the runner link: `session.changes.read` with a
 * fresh `commandId`, then the `session.changes` or `command.failed` that
 * names it, through `LinkRepliesPort`. Sent only to a runner whose hello
 * named `session.changes.read`: an older one would log the frame and never
 * answer.
 */
@Injectable()
export class RelaySessionChangesAdapter implements SessionChangesPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async read(
    hostId: string,
    sessionId: string,
    scope: SessionChangesScope,
  ): Promise<SessionChangesOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('session.changes.read')) return { kind: 'not_supported' };

    const commandId = randomUUID();
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, commandId, SESSION_CHANGES_TIMEOUT_MS);
    if (!link.send({ type: 'session.changes.read', commandId, sessionId, scope })) {
      pending.cancel();
      return { kind: 'host_offline' };
    }
    const reply = await pending.reply;
    if (!reply) return { kind: 'timed_out' };
    if (reply.type === 'command.failed') {
      return { kind: 'failed', code: reply.code, detail: reply.detail };
    }
    if (reply.type !== 'session.changes' || reply.sessionId !== sessionId) {
      return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    }
    return { kind: 'listed', checkouts: reply.checkouts };
  }
}
