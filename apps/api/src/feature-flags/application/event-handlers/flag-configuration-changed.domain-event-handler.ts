import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { FlagChangeRepositoryPort } from '../../database/flag-change.repository.port';
import { FlagConfigurationChangedDomainEvent } from '../../domain/events/flag-configuration-changed.domain-event';
import { FLAG_CHANGE_REPOSITORY, FLAG_SNAPSHOT } from '../../feature-flags.di-tokens';
import type { FlagSnapshotPort } from '../flag-evaluator.port';

/**
 * Two consequences of every flag or segment change, delivered from the outbox
 * after the change commits:
 *
 * 1. an entry on the audit trail — who, what, why, and the before/after;
 * 2. an immediate snapshot reload on this replica, so the person who pulled
 *    the switch sees it hold on their next request instead of up to a poll
 *    interval later. Other replicas notice on their next poll.
 *
 * Throwing on either failure is deliberate: the relay retries the row with
 * backoff. A change that is live but unaudited is the one outcome a flag
 * system in a regulated product cannot have, and a delivery marked done while
 * this replica still serves the old rules would leave it stale until the
 * next poll. The audit write is idempotent on the event id, so a retry after
 * a failed reload records nothing twice.
 */
@Injectable()
export class FlagConfigurationChangedDomainEventHandler {
  constructor(
    @Inject(FLAG_CHANGE_REPOSITORY)
    private readonly changes: FlagChangeRepositoryPort,
    @Inject(FLAG_SNAPSHOT)
    private readonly snapshot: FlagSnapshotPort,
  ) {}

  @OnEvent(FlagConfigurationChangedDomainEvent.name)
  async handle(event: FlagConfigurationChangedDomainEvent): Promise<void> {
    await this.changes.record({
      id: event.id,
      subjectType: event.subjectType,
      subjectKey: event.subjectKey,
      action: event.action,
      actorId: event.actorId ?? null,
      comment: event.comment ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
      createdAt: new Date(event.metadata?.timestamp ?? Date.now()),
    });
    await this.snapshot.reload();
  }
}
