import type { Paginated } from '@oppenheimer/backend-ddd';
import type {
  FlagChangeAction,
  FlagChangeSubject,
} from '../domain/events/flag-configuration-changed.domain-event';

/** One audit entry, as stored. */
export interface FlagChangeRecord {
  /** The id of the domain event that produced it — what makes recording idempotent. */
  id: string;
  subjectType: FlagChangeSubject;
  subjectKey: string;
  action: FlagChangeAction;
  actorId: string | null;
  comment: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

export interface FindFlagChangesParams {
  subjectType?: FlagChangeSubject;
  subjectKey?: string;
  page: number;
  limit: number;
}

/**
 * The append-only audit trail. Not an aggregate: nothing changes a row once
 * written, so there is no invariant to protect and no `RepositoryPort` to
 * satisfy.
 */
export interface FlagChangeRepositoryPort {
  /**
   * Appends an entry. Recording the same event twice is a no-op, because the
   * outbox delivers at least once.
   */
  record(change: FlagChangeRecord): Promise<void>;
  find(params: FindFlagChangesParams): Promise<Paginated<FlagChangeRecord>>;
}
