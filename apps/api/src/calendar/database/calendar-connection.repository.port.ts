import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { CalendarConnectionEntity } from '../domain/calendar-connection.entity';

/**
 * A connection is a person's: every read is of the caller's own, in their
 * workspace. A person holds at most five, so a list of them is bounded.
 */
export interface CalendarConnectionRepositoryPort {
  /** The caller's own accounts, oldest first: the order their events are read and deduplicated in. */
  findAllOwn(scope: AccessScope): Promise<CalendarConnectionEntity[]>;
  /** One of the caller's own; someone else's is none. */
  findOwnById(scope: AccessScope, id: string): Promise<Option<CalendarConnectionEntity>>;
  insert(connection: CalendarConnectionEntity): Promise<void>;
  /** Writes a reconnect: the new grant, the account and the status. */
  save(connection: CalendarConnectionEntity): Promise<void>;
  markRevoked(connection: CalendarConnectionEntity): Promise<void>;
  /**
   * Keys a row written before accounts were keyed by Google's `sub`, once a
   * token refresh says which account it is. Leaves it unkeyed when another of
   * the person's rows already holds that subject.
   */
  fillSubject(connection: CalendarConnectionEntity, subject: string): Promise<void>;
  delete(connection: CalendarConnectionEntity): Promise<void>;
}
