import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import type {
  ProtocolMessage,
  SessionCloseMessage,
  SessionCreateMessage,
  SessionImageMessage,
  SessionRestartMessage,
  SessionStopMessage,
} from '@oppenheimer/shared/protocol';
import { missingFileCapability } from '@oppenheimer/shared/protocol';
import type {
  SessionCloseSpec,
  SessionDispatchOutcome,
  SessionDispatchPort,
  SessionFileSpec,
  SessionLaunchSpec,
  SessionPrepareSpec,
} from '../../sessions/application/session-dispatch.port';
import type { SessionCheckoutEntity } from '../../sessions/domain/session-checkout.entity';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import type { ParkedFilePort } from '../application/parked-file.port';
import { LINK_REGISTRY, PARKED_FILES } from '../links.di-tokens';

const OFFLINE: SessionDispatchOutcome = { delivered: false, hints: ['host_offline'] };
const DELIVERED: SessionDispatchOutcome = { delivered: true, hints: [] };
const NOT_SUPPORTED: SessionDispatchOutcome = { delivered: false, hints: ['not_supported'] };

/**
 * `SessionDispatchPort` over the runner link.
 *
 * It **writes nothing**: one user action is one log entry, appended by the command
 * handler in its own transaction. `delivered: true` means the frame was queued on a
 * live link to the session's host; `false` with `host_offline` means no such link
 * now. A session created while its host is offline keeps its task in the log, and
 * the hello reconciliation (`SessionReconciliationResolver`) dispatches it again.
 *
 * Every command carries a fresh `commandId`; the runner is idempotent by session id
 * and command id, so a reconnect that redelivers is harmless.
 */
@Injectable()
export class RelayDispatchAdapter implements SessionDispatchPort {
  private readonly logger = new Logger(RelayDispatchAdapter.name);

  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(PARKED_FILES)
    private readonly files: ParkedFilePort,
  ) {}

  async create(
    session: WorkSessionEntity,
    spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, (link) => {
      // A runner that cannot take these files at launch would drop them or
      // refuse them, and start the task without them. The ids stay in the
      // log, so the hello of an updated runner is sent them.
      const types = (spec.images ?? []).map((file) => file.mediaType);
      if (missingFileCapability(link.capabilities, 'create', types)) return NOT_SUPPORTED;
      return this.deliver(link, createMessage(session, spec));
    });
  }

  async stop(session: WorkSessionEntity): Promise<SessionDispatchOutcome> {
    return this.withLink(session, (link) => {
      const message: SessionStopMessage = {
        type: 'session.stop',
        commandId: randomUUID(),
        sessionId: session.id,
      };
      return this.deliver(link, message);
    });
  }

  async restart(
    session: WorkSessionEntity,
    _spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, (link) => {
      const message: SessionRestartMessage = {
        type: 'session.restart',
        commandId: randomUUID(),
        sessionId: session.id,
      };
      return this.deliver(link, message);
    });
  }

  async close(session: WorkSessionEntity, spec: SessionCloseSpec): Promise<SessionDispatchOutcome> {
    return this.withLink(session, (link) => {
      const message: SessionCloseMessage = {
        type: 'session.close',
        commandId: randomUUID(),
        sessionId: session.id,
        acceptUnpushedWork: spec.acceptUnpushedWork,
      };
      return this.deliver(link, message);
    });
  }

  async pasteFile(
    session: WorkSessionEntity,
    file: SessionFileSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, async (link) => {
      // A runner that cannot take this file would log the frame as unknown or
      // refuse it after the park, while this answered "delivered".
      if (missingFileCapability(link.capabilities, 'paste', [file.mediaType])) return NOT_SUPPORTED;
      const commandId = randomUUID();
      await this.files.park(commandId, {
        hostId: session.hostId,
        sessionId: session.id,
        mediaType: file.mediaType,
        data: file.data,
      });
      const message: SessionImageMessage = {
        type: 'session.image',
        commandId,
        sessionId: session.id,
        window: file.window,
        mediaType: file.mediaType,
      };
      return this.deliver(link, message);
    });
  }

  async addCheckout(
    session: WorkSessionEntity,
    _checkout: SessionCheckoutEntity,
    _spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    // There is no frame for this on the wire yet (`01-protocol.md` lists none),
    // so nothing is sent and the caller is told so rather than handed a delivery
    // that did not happen: the row is ahead of the host until the launch is re-sent.
    return this.withLink(session, () => NOT_SUPPORTED);
  }

  async removeCheckout(
    session: WorkSessionEntity,
    _checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, () => NOT_SUPPORTED);
  }

  prepareRefusal(hostId: string): 'host_offline' | 'not_supported' | null {
    const link = this.links.find(hostId);
    if (!link) return 'host_offline';
    return link.capabilities.includes('repository.prepare') ? null : 'not_supported';
  }

  prepare(hostId: string, spec: SessionPrepareSpec): SessionDispatchOutcome {
    const link = this.links.find(hostId);
    if (!link) return OFFLINE;
    if (!link.capabilities.includes('repository.prepare')) return NOT_SUPPORTED;
    // Sealed to the host before it got here, as `credentials.grant` is: the
    // relay carries the token and cannot read it.
    return this.deliver(link, {
      type: 'repository.prepare',
      commandId: randomUUID(),
      githubRepoId: spec.githubRepoId,
      repositoryFullName: spec.repositoryFullName,
      baseBranch: spec.baseBranch,
      sealed: spec.sealed,
      expiresAt: spec.expiresAt.toISOString(),
    });
  }

  /** `send` on the session's host link, or `host_offline` when it holds none. */
  private async withLink(
    session: WorkSessionEntity,
    send: (link: RunnerLink) => SessionDispatchOutcome | Promise<SessionDispatchOutcome>,
  ): Promise<SessionDispatchOutcome> {
    const link = this.links.find(session.hostId);
    return link ? send(link) : OFFLINE;
  }

  private deliver(link: RunnerLink, message: ProtocolMessage): SessionDispatchOutcome {
    if (!link.send(message)) {
      this.logger.warn({
        message: 'a command could not be queued on the host link',
        hostId: link.hostId,
        type: message.type,
      });
      return OFFLINE;
    }
    return DELIVERED;
  }
}

function createMessage(session: WorkSessionEntity, spec: SessionLaunchSpec): SessionCreateMessage {
  return {
    type: 'session.create',
    commandId: randomUUID(),
    sessionId: session.id,
    organizationSlug: spec.organizationSlug,
    sessionSlug: session.slug,
    agent: session.agent,
    launch: {
      ...(session.launch.model ? { model: session.launch.model } : {}),
      ...(session.launch.permission ? { permission: session.launch.permission } : {}),
      ...(session.launch.effort ? { effort: session.launch.effort } : {}),
      // The agent's conversation takes the session's own id, so the transcript
      // the CLI keeps is findable by the one name both sides already agree on
      // — and a session that has stopped can be reopened rather than read back
      // out of a pane that no longer exists.
      //
      // Only for an agent that has a conversation to name: a blank terminal
      // keeps no transcript, and sending it an id would be a field the host
      // has nothing to do with.
      ...(CODING_AGENTS[session.agent]?.launch.conversation?.create
        ? { conversation: session.id }
        : {}),
    },
    ...(spec.prompt ? { prompt: spec.prompt } : {}),
    ...(spec.images?.length ? { images: spec.images } : {}),
    branch: spec.branch,
    checkouts: session.liveCheckouts.map((checkout) => ({
      checkoutId: checkout.id,
      githubRepoId: Number(checkout.githubRepoId),
      repositoryFullName: checkout.repositoryFullName,
      directoryName: checkout.directoryName,
      baseBranch: checkout.baseBranch,
    })),
    cwdCheckoutId: session.cwdCheckoutId,
  };
}
