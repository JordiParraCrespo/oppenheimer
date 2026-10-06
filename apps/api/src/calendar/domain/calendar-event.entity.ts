import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { CALENDAR_EVENT_NOTES_MAX, CALENDAR_EVENT_TITLE_MAX } from '@oppenheimer/shared';
import { timesFitTheDay } from './calendar-range.policy';

export interface CalendarEventProps {
  organizationId: string;
  title: string;
  notes: string;
  /** A calendar day, `YYYY-MM-DD`, in the viewer's timezone like a task's due date. */
  date: string;
  allDay: boolean;
  /** `HH:MM`; both set unless all day. */
  startTime: string | null;
  endTime: string | null;
  busy: boolean;
  createdByUserId: string | null;
}

export type CalendarEventEdit = Partial<
  Pick<CalendarEventProps, 'title' | 'notes' | 'date' | 'allDay' | 'startTime' | 'endTime' | 'busy'>
>;

/**
 * A personal event on Plan's calendar (`product/versions/mvp/20-plan-calendar.md`
 * §2): the workspace's own, beside the read-only Google layer. One day, all day or
 * from a start to an end on it; no recurrence.
 */
export class CalendarEventEntity extends AggregateRoot<CalendarEventProps> {
  static create(create: CreateEntityProps<CalendarEventProps>): CalendarEventEntity {
    return new CalendarEventEntity(create);
  }

  static createNew(props: CalendarEventProps): CalendarEventEntity {
    const event = new CalendarEventEntity({ id: randomUUID(), props: { ...props } });
    event.normalise();
    event.validate();
    return event;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get title(): string {
    return this.props.title;
  }
  get notes(): string {
    return this.props.notes;
  }
  get date(): string {
    return this.props.date;
  }
  get allDay(): boolean {
    return this.props.allDay;
  }
  get startTime(): string | null {
    return this.props.startTime;
  }
  get endTime(): string | null {
    return this.props.endTime;
  }
  get busy(): boolean {
    return this.props.busy;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }

  edit(changes: CalendarEventEdit): void {
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) Object.assign(this.props, { [key]: value });
    }
    this.normalise();
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.title || this.props.title.length > CALENDAR_EVENT_TITLE_MAX) {
      throw new ArgumentInvalidException('An event has a title');
    }
    if (this.props.notes.length > CALENDAR_EVENT_NOTES_MAX) {
      throw new ArgumentInvalidException('An event’s notes are too long');
    }
    if (!timesFitTheDay(this.props)) {
      throw new ArgumentInvalidException('An event ends after it starts');
    }
  }

  /** An all-day event has no times; it keeps none it was sent. */
  private normalise(): void {
    this.props.title = this.props.title.trim();
    if (this.props.allDay) {
      this.props.startTime = null;
      this.props.endTime = null;
    }
  }
}
