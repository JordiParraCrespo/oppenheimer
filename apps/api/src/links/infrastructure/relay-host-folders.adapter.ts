import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { FsFindMessage, FsListMessage } from '@oppenheimer/shared/protocol';
import type {
  HostFolderSearch,
  HostFoldersOutcome,
  HostFoldersPort,
} from '../../sessions/application/host-folders.port';
import type { LinkRegistryPort } from '../application/link-registry.port';
import type { LinkRepliesPort, LinkReply } from '../application/link-replies.port';
import { LINK_REGISTRY, LINK_REPLIES } from '../links.di-tokens';

/**
 * How long a listing may take. A runner reads one directory and stats its
 * children; past this the person is better told the host did not answer than
 * left looking at a spinner.
 */
export const FS_LIST_TIMEOUT_MS = 5_000;

/**
 * How long a search may take. The runner stops walking well inside this and
 * answers with what it found; the rest is the link and a lane busy with the
 * keystroke before.
 */
export const FS_FIND_TIMEOUT_MS = 5_000;

/** What asking came back with: the reply, or why there is none. */
type Asked =
  | { kind: 'replied'; reply: LinkReply }
  | Exclude<HostFoldersOutcome, { kind: 'listed' }>;

/**
 * `HostFoldersPort` over the runner link: `fs.list` or `fs.find` with a fresh
 * `commandId`, then the `fs.listing`, `fs.found` or `command.failed` that
 * names it, through `LinkRepliesPort`. Each is sent only to a runner whose
 * hello named it; an older one would log the frame as unknown and never answer.
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
    const message: FsListMessage = {
      type: 'fs.list',
      commandId: randomUUID(),
      ...(path ? { path } : {}),
    };
    const reply = await this.ask(hostId, message, FS_LIST_TIMEOUT_MS);
    if (reply.kind !== 'replied') return reply;
    // A reply is matched by command id, so another kind is a runner bug.
    if (reply.reply.type !== 'fs.listing') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...listing } = reply.reply;
    return { kind: 'listed', listing };
  }

  async find(hostId: string, query: string): Promise<HostFoldersOutcome<HostFolderSearch>> {
    const message: FsFindMessage = { type: 'fs.find', commandId: randomUUID(), query };
    const reply = await this.ask(hostId, message, FS_FIND_TIMEOUT_MS);
    if (reply.kind !== 'replied') return reply;
    if (reply.reply.type !== 'fs.found') return { kind: 'failed', code: 'UNEXPECTED_REPLY' };
    const { type: _type, commandId: _commandId, ...search } = reply.reply;
    return { kind: 'listed', listing: search };
  }

  /**
   * Send `message` to a runner whose hello named its type, and wait for
   * what answers its command id: a refusal is resolved here, a reply returned.
   */
  private async ask(
    hostId: string,
    message: FsListMessage | FsFindMessage,
    timeoutMs: number,
  ): Promise<Asked> {
    const link = this.links.find(hostId);
    if (!link) return { kind: 'host_offline' };
    if (!link.capabilities.includes(message.type)) return { kind: 'not_supported' };
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
    return { kind: 'replied', reply };
  }
}
