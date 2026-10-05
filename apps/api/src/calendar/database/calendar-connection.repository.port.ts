import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { CalendarConnectionEntity } from '../domain/calendar-connection.entity';

/** A connection is a person's: every read is of the caller's own, in their workspace. */
export interface CalendarConnectionRepositoryPort {
  findOwn(scope: AccessScope): Promise<Option<CalendarConnectionEntity>>;
  /** Insert, or replace the caller's existing connection with a new grant. */
  upsert(connection: CalendarConnectionEntity): Promise<void>;
  markRevoked(connection: CalendarConnectionEntity): Promise<void>;
  delete(connection: CalendarConnectionEntity): Promise<void>;
}
