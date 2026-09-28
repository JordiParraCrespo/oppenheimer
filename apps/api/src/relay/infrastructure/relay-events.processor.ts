import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CommandFailedMessage,
  EventsAppendMessage,
  HeartbeatMessage,
  HelloMessage,
} from '@oppenheimer/shared/protocol';
import { RUNNER_LINK_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import type { HostPresencePort } from '../../hosts/application/host-presence.port';
import { HOST_PRESENCE } from '../../hosts/hosts.di-tokens';
import type { RunnerLink } from '../../links/application/link-registry.port';
import type {
  RecordSessionEventsPort,
  RunnerEventAck,
} from '../../sessions/application/record-session-events.port';
import type { SessionReconciliationPort } from '../../sessions/application/session-reconciliation.port';
import { RECORD_SESSION_EVENTS, SESSION_RECONCILIATION } from '../../sessions/sessions.di-tokens';

/** RFC 6455's generic "policy violation": not one of the link's own codes, so the runner redials. */
const POLICY_VIOLATION = 1008;

/**
 * What the control plane does with what a runner reports: a batch of one
 * session's events goes through the sessions module's door and is acknowledged
 * **by key**; a hello or a heartbeat is the host's presence.
 *
 * Nothing here writes a session's log directly — the relay never does — and the
 * ack is whatever the sessions module answered, so a batch for a session this
 * host does not own is rejected key by key and the runner stops resending it.
 */
@Injectable()
export class RelayEventsProcessor {
  private readonly logger = new Logger(RelayEventsProcessor.name);

  constructor(
    @Inject(RECORD_SESSION_EVENTS)
    private readonly events: RecordSessionEventsPort,
    @Inject(HOST_PRESENCE)
    private readonly presence: HostPresencePort,
    @Inject(SESSION_RECONCILIATION)
    private readonly reconciliation: SessionReconciliationPort,
  ) {}

  async onHello(
    link: RunnerLink,
    hello: HelloMessage,
    connectedAt = new Date(),
    address: string | null = null,
  ): Promise<void> {
    const observed = await this.presence.observe(link.hostId, { facts: hello.host, connectedAt });
    if (observed !== 'recorded') {
      // Unpaired (or its owner refused) between the handshake's check and this
      // hello: nothing it holds is reconciled, and it is told why.
      this.closeRefused(link, observed);
      return;
    }
    // Where the link came from, recorded once per link. A failure here costs
    // the network row, never the link: presence is already written.
    if (address) {
      await this.presence.connectedFrom(link.hostId, address, connectedAt).catch((error) =>
        this.logger.warn({
          message: 'the network a runner connected from could not be recorded',
          hostId: link.hostId,
          error: String(error),
        }),
      );
    }
    // The snapshot is what the runner holds; the rows are what it should hold.
    // A launch that never arrived goes out again, and a pane tmux lost is
    // recorded stopped — reconciled, never replayed from a queue.
    const outcome = await this.reconciliation.reconcile(
      link.hostId,
      link.runId,
      hello.sessions.map((session) => session.sessionId),
    );
    this.logger.log({
      message: 'runner link up',
      hostId: link.hostId,
      runId: link.runId,
      epoch: link.epoch,
      runnerVersion: hello.runnerVersion,
      sessions: hello.sessions.length,
      redispatched: outcome.redispatched.length,
      stopped: outcome.stopped.length,
    });
  }

  async onHeartbeat(link: RunnerLink, heartbeat: HeartbeatMessage): Promise<void> {
    // Receipt time, not `sentAt`: presence is when this process heard from the
    // host, and a skewed clock on the host must not take it offline.
    const report = {
      facts: heartbeat.host,
      channel: heartbeat.channel,
      loadAverage: heartbeat.load.loadAverage1m,
      memoryAvailableBytes: heartbeat.load.memoryAvailableBytes,
      roundTripMillis: link.roundTripMillis ?? null,
    };
    const observed = await this.presence.observe(link.hostId, report);
    if (observed !== 'recorded') {
      // The host was unpaired while its link was open. The domain event closes
      // the link at once on the instance that holds it; this is what closes it
      // on every other one, within a heartbeat. The same goes for an owner
      // banned or deactivated while it was open, which raises no event here.
      this.closeRefused(link, observed);
    }
  }

  private closeRefused(link: RunnerLink, why: 'unpaired' | 'owner_refused'): void {
    if (why === 'unpaired') {
      this.logger.log({ message: 'closing the link of an unpaired host', hostId: link.hostId });
      link.close(RUNNER_LINK_CLOSE_CODES.UNPAIRED, 'host unpaired');
      return;
    }
    // Not UNPAIRED, which is terminal: a ban can be lifted. A plain policy
    // close sends the runner down its reconnect ladder, and the handshake
    // refuses it (401) until the owner may act again.
    this.logger.log({
      message: 'closing the link of a host whose owner may not act',
      hostId: link.hostId,
    });
    link.close(POLICY_VIOLATION, 'owner may not act');
  }

  /**
   * A runner refused a session command no attachment was waiting on.
   *
   * The refusal is the runner's answer, so it goes into the session's log
   * through the same door as the runner's own events, keyed by the command so
   * a repeat is the same entry. A refused `session.create` is `session.failed`,
   * which moves the row off `starting`; any other refusal is `command.failed`,
   * which the fold keeps without acting on. Either way the host's code and
   * detail are on the log instead of nowhere (#56).
   */
  async onCommandFailed(link: RunnerLink, refusal: CommandFailedMessage): Promise<void> {
    const command = link.takeSessionCommand(refusal.commandId);
    if (!command) {
      this.logger.warn({
        message: 'a runner refused a command this link did not send',
        hostId: link.hostId,
        commandId: refusal.commandId,
        code: refusal.code,
      });
      return;
    }
    const payload = {
      command: command.type,
      code: refusal.code,
      ...(refusal.detail ? { detail: refusal.detail } : {}),
    };
    const ack = await this.events.record({
      batchId: `refused-${refusal.commandId}`,
      sessionId: command.sessionId,
      hostId: link.hostId,
      events: [
        {
          idempotencyKey: `refused-${refusal.commandId}:1`,
          kind: command.type === 'session.create' ? 'session.failed' : 'command.failed',
          payload: JSON.stringify(payload),
          occurredAt: new Date().toISOString(),
        },
      ],
    });
    this.logger.warn({
      message: 'a runner refused a session command',
      hostId: link.hostId,
      sessionId: command.sessionId,
      command: command.type,
      code: refusal.code,
      recorded: ack.accepted.length > 0,
    });
  }

  /**
   * One or more consecutive batches for **one** session, applied as one append —
   * one lock and one insert — and acknowledged as the runner sent them: an
   * `events.ack` per `batchId`, naming only that batch's keys. The runner keeps
   * each batch until its own ack accounts for every key in it, so an ack that
   * named another batch's keys, or one ack for several, would be resent forever.
   */
  async onEventsAppend(
    link: RunnerLink,
    batches: readonly [EventsAppendMessage, ...EventsAppendMessage[]],
  ): Promise<void> {
    const [first] = batches;
    const ack = await this.events.record({
      batchId: first.batchId,
      sessionId: first.sessionId,
      hostId: link.hostId,
      events: batches.flatMap((batch) => batch.events),
    });
    for (const batch of batches) {
      const own = ackFor(batch, ack);
      link.send({
        type: 'events.ack',
        batchId: batch.batchId,
        accepted: own.accepted,
        ...(own.rejected.length ? { rejected: own.rejected } : {}),
      });
    }
  }
}

/** The part of a coalesced append's answer that is about this batch's keys. */
function ackFor(
  batch: EventsAppendMessage,
  ack: RunnerEventAck,
): Pick<RunnerEventAck, 'accepted' | 'rejected'> {
  const keys = new Set(batch.events.map((event) => event.idempotencyKey));
  return {
    accepted: ack.accepted.filter((key) => keys.has(key)),
    rejected: ack.rejected.filter((rejection) => keys.has(rejection.idempotencyKey)),
  };
}
