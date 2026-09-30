import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ProtocolMessage,
  SessionCloseMessage,
  SessionCreateMessage,
  SessionImageMessage,
  SessionRestartMessage,
  SessionStopMessage,
} from '@oppenheimer/shared/protocol';
import type {
  SessionCloseSpec,
  SessionDispatchOutcome,
  SessionDispatchPort,
  SessionImageSpec,
  SessionLaunchSpec,
} from '../../sessions/application/session-dispatch.port';
import type { SessionCheckoutEntity } from '../../sessions/domain/session-checkout.entity';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import type { ParkedImagePort } from '../application/parked-image.port';
import { LINK_REGISTRY, PARKED_IMAGES } from '../links.di-tokens';

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
    @Inject(PARKED_IMAGES)
    private readonly images: ParkedImagePort,
  ) {}

  async create(
    session: WorkSessionEntity,
    spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, (link) => {
      // A runner that did not say it takes images at launch would drop the
      // field and start the task without them. The ids stay in the log, so
      // the hello of an updated runner is sent them.
      if (spec.images?.length && !link.capabilities.includes('session.create.images')) {
        return NOT_SUPPORTED;
      }
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

  async pasteImage(
    session: WorkSessionEntity,
    image: SessionImageSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, async (link) => {
      // A runner that did not say it takes images would log the frame as
      // unknown and paste nothing, while this answered "delivered".
      if (!link.capabilities.includes('session.image')) return NOT_SUPPORTED;
      const commandId = randomUUID();
      await this.images.park(commandId, {
        hostId: session.hostId,
        sessionId: session.id,
        mediaType: image.mediaType,
        data: image.data,
      });
      const message: SessionImageMessage = {
        type: 'session.image',
        commandId,
        sessionId: session.id,
        window: image.window,
        mediaType: image.mediaType,
      };
      return this.deliver(link, message);
    });
  }

  async addCheckout(
    session: WorkSessionEntity,
    _checkout: SessionCheckoutEntity,
    _spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    // There is no frame for this on the wire yet (01 lists none), so nothing
    // is sent and the caller is told so rather than handed a delivery that did
    // not happen: the row is ahead of the host until the launch is re-sent.
    return this.withLink(session, () => NOT_SUPPORTED);
  }

  async removeCheckout(
    session: WorkSessionEntity,
    _checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome> {
    return this.withLink(session, () => NOT_SUPPORTED);
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
