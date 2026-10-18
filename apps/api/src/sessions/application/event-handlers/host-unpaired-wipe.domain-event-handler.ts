import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';

/**
 * Closes every session on a host removed with "Also delete everything on this
 * machine" (`product/versions/mvp/14-hosts-settings.md`). The host was told to close
 * them all as its link closed (`RUNNER_LINK_CLOSE_REASONS.WIPE`), so their worktrees
 * are going: every session not resolved yet is closed, stopped ones included, and the
 * console offers no restart into one. A plain removal is
 * `HostUnpairedStopsSessionsDomainEventHandler`'s.
 *
 * Delivery is at least once, so the entry is keyed by the domain event's id.
 */
@Injectable()
export class HostUnpairedClosesSessionsDomainEventHandler {
  private readonly logger = new Logger(HostUnpairedClosesSessionsDomainEventHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  @OnEvent(HostUnpairedDomainEvent.name)
  async handle(event: Pick<HostUnpairedDomainEvent, 'id' | 'aggregateId' | 'wipe'>): Promise<void> {
    if (!event.wipe) return;
    const unresolved = await this.sessions.findUnresolvedOnHostForSystem(event.aggregateId);
    for (const session of unresolved) {
      await this.sessions.appendEvents(session, [
        {
          idempotencyKey: WorkSessionEntity.apiIdempotencyKey(event.id, SESSION_EVENT_KINDS.CLOSED),
          source: 'api',
          kind: SESSION_EVENT_KINDS.CLOSED,
          payload: { requestedBy: 'host.unpaired.wipe' },
        },
      ]);
    }
    if (unresolved.length > 0) {
      this.logger.log({
        message: 'closed the sessions of a removed host it was told to clean up',
        hostId: event.aggregateId,
        closed: unresolved.length,
      });
    }
  }
}
