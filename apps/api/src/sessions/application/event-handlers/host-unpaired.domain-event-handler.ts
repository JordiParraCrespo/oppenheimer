import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';

/**
 * Stops every session on a host the moment the host is removed; the remove dialog
 * promises its sessions "are stopped and their terminals closed; logs are kept".
 *
 * Stop, not close: a close pushes branches and removes worktrees, which only the host
 * can do, and the host is gone. Stopped is what the control plane decides alone
 * (`StopSessionCommandHandler`), so each session keeps its checkouts and log; the
 * relay closing the link ends the tmux sessions on a runner that is still up.
 *
 * A removal that asked for the machine to be cleaned up closes instead, and every
 * session not resolved yet, stopped ones included: the host was told to close them
 * all as its link closed (`RUNNER_LINK_CLOSE_REASONS.WIPE`), so their worktrees are
 * going and the console should not offer a restart into one.
 *
 * Delivery is at least once, so the entry is keyed by the domain event's id. Nothing
 * is dispatched: the host was just told, terminally, that it is no longer one.
 */
@Injectable()
export class HostUnpairedStopsSessionsDomainEventHandler {
  private readonly logger = new Logger(HostUnpairedStopsSessionsDomainEventHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  @OnEvent(HostUnpairedDomainEvent.name)
  async handle(
    event: Pick<HostUnpairedDomainEvent, 'id' | 'aggregateId'> & { wipe?: boolean },
  ): Promise<void> {
    const kind = event.wipe ? SESSION_EVENT_KINDS.CLOSED : SESSION_EVENT_KINDS.STOPPED;
    const ended = event.wipe
      ? await this.sessions.findUnresolvedOnHostForSystem(event.aggregateId)
      : await this.sessions.findRunningOnHostForSystem(event.aggregateId);
    for (const session of ended) {
      await this.sessions.appendEvents(session, [
        {
          idempotencyKey: WorkSessionEntity.apiIdempotencyKey(event.id, kind),
          source: 'api',
          kind,
          payload: { requestedBy: event.wipe ? 'host.unpaired.wipe' : 'host.unpaired' },
        },
      ]);
    }
    if (ended.length > 0) {
      this.logger.log({
        message: event.wipe
          ? 'closed the sessions of a removed host it was told to clean up'
          : 'stopped the sessions of a removed host',
        hostId: event.aggregateId,
        ended: ended.length,
      });
    }
  }
}
