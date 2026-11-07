import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SharedPreviewGetMessage } from '@oppenheimer/shared/protocol';
import type {
  SessionSharedFilesPort,
  SessionSharedPreviewOutcome,
} from '../../sessions/application/session-shared-files.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a preview may take. The runner lists one folder and reads one
 * small file it wrote itself; past this the bot is told the host did not
 * answer rather than holding its turn.
 */
export const SHARED_PREVIEW_TIMEOUT_MS = 5_000;

/**
 * `SessionSharedFilesPort` over the runner link: `shared.preview.get` with a
 * fresh `commandId`, then the `shared.preview` or `command.failed` that names
 * it, through `LinkRepliesPort`. Sent only to a runner whose hello named
 * `shared.preview`; an older one would log the frame as unknown and never
 * answer.
 */
@Injectable()
export class RelaySessionSharedFilesAdapter implements SessionSharedFilesPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async preview(
    hostId: string,
    sessionId: string,
    fileId: string,
  ): Promise<SessionSharedPreviewOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('shared.preview')) return { kind: 'not_supported' };

    const message: SharedPreviewGetMessage = {
      type: 'shared.preview.get',
      commandId: randomUUID(),
      sessionId,
      fileId,
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, SHARED_PREVIEW_TIMEOUT_MS);
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
    if (reply.type !== 'shared.preview') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    return { kind: 'preview', mediaType: reply.mediaType, data: reply.data };
  }
}
