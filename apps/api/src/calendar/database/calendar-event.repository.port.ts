import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { CalendarEventEntity } from '../domain/calendar-event.entity';

export interface CalendarEventRepositoryPort {
  /** The events between two days, both included, by day and start. */
  findInRange(
    scope: AccessScope,
    range: { from: string; to: string },
  ): Promise<CalendarEventEntity[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<CalendarEventEntity>>;
  insert(event: CalendarEventEntity): Promise<void>;
  save(event: CalendarEventEntity): Promise<void>;
  delete(event: CalendarEventEntity): Promise<void>;
}
