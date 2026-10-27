import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { FsListMessage } from '@oppenheimer/shared/protocol';
import type {
  HostFoldersOutcome,
  HostFoldersPort,
} from '../../sessions/application/host-folders.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a listing may take. A runner reads one directory and stats its
 * children; past this the person is better told the host did not answer than
 * left looking at a spinner.
 */
export const FS_LIST_TIMEOUT_MS = 5_000;

/**
 * `HostFoldersPort` over the runner link: `fs.list` with a fresh `commandId`,
 * then the `fs.listing` or `command.failed` that names it, through
 * `LinkRepliesPort`. Sent only to a runner whose hello named `fs.list`; an
 * older one would log the frame as unknown and never answer.
 */
@Injectable()
export class RelayHostFoldersAdapter implements HostFoldersPort {
  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(LINK_REPLIES)
    private readonly replies: LinkRepliesPort,
  ) {}

  async list(hostId: string, path?: string): Promise<HostFoldersOutcome> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes('fs.list')) return { kind: 'not_supported' };

    const message: FsListMessage = {
      type: 'fs.list',
      commandId: randomUUID(),
      ...(path ? { path } : {}),
    };
    // Waiting before sending, so an answer faster than this line cannot be missed.
    const pending = this.replies.expect(hostId, message.commandId, FS_LIST_TIMEOUT_MS);
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
    if (reply.type !== 'fs.listing') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...listing } = reply;
    return { kind: 'listed', listing };
  }
}
