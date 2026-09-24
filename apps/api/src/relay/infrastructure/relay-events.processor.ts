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
    if (!(await this.presence.observe(link.hostId, hello.host))) {
      // Unpaired between the handshake's check and this hello: nothing it holds
      // is reconciled, and it is told why rather than left to redial.
      this.closeUnpaired(link);
      return;
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
    if (!(await this.presence.observe(link.hostId, heartbeat.host))) {
      // The host was unpaired while its link was open. The domain event closes
      // the link at once on the instance that holds it; this is what closes it
      // on every other one, within a heartbeat.
      this.closeUnpaired(link);
    }
  }

  private closeUnpaired(link: RunnerLink): void {
    this.logger.log({ message: 'closing the link of an unpaired host', hostId: link.hostId });
    link.close(RUNNER_LINK_CLOSE_CODES.UNPAIRED, 'host unpaired');
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
