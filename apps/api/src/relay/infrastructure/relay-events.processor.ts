import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  EventsAppendMessage,
  HeartbeatMessage,
  HelloMessage,
} from '@oppenheimer/shared/protocol';
import type { HostPresencePort } from '../../hosts/application/host-presence.port';
import { HOST_PRESENCE } from '../../hosts/hosts.di-tokens';
import type { RunnerLink } from '../../links/application/link-registry.port';
import type { RecordSessionEventsPort } from '../../sessions/application/record-session-events.port';
import type { SessionReconciliationPort } from '../../sessions/application/session-reconciliation.port';
import { RECORD_SESSION_EVENTS, SESSION_RECONCILIATION } from '../../sessions/sessions.di-tokens';

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

  async onHello(link: RunnerLink, hello: HelloMessage): Promise<void> {
    await this.presence.observe(link.hostId, hello.host);
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
    await this.presence.observe(link.hostId, heartbeat.host);
  }

  async onEventsAppend(link: RunnerLink, batch: EventsAppendMessage): Promise<void> {
    const ack = await this.events.record({
      batchId: batch.batchId,
      sessionId: batch.sessionId,
      hostId: link.hostId,
      events: batch.events,
    });
    link.send({
      type: 'events.ack',
      batchId: ack.batchId,
      accepted: ack.accepted,
      ...(ack.rejected.length ? { rejected: ack.rejected } : {}),
    });
  }
}
