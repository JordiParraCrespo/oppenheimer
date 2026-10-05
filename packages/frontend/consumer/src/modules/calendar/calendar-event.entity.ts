/**
 * An event on Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the
 * workspace's own (`personal`, editable) or one of the viewer's Google Calendar
 * (`google`, read-only). Wall-clock: a day, and times on it, in the viewer's zone.
 */
export class CalendarEventEntity {
  constructor(
    public readonly id: string,
    public readonly source: 'personal' | 'google',
    public readonly title: string,
    public readonly notes: string,
    public readonly date: string,
    public readonly allDay: boolean,
    public readonly startTime: string | null,
    public readonly endTime: string | null,
    public readonly busy: boolean,
    /** Where a Google event opens in Google Calendar. */
    public readonly url: string | null,
  ) {}

  get isEditable(): boolean {
    return this.source === 'personal';
  }
}

/** The caller's own Google Calendar connection. */
export class GoogleCalendarConnectionEntity {
  constructor(
    public readonly connected: boolean,
    public readonly accountEmail: string | null,
    public readonly status: 'active' | 'revoked' | null,
  ) {}

  /** Connected, and Google still honours the grant. */
  get isActive(): boolean {
    return this.connected && this.status === 'active';
  }

  /** Google dropped the grant: the card offers Reconnect. */
  get needsReconnect(): boolean {
    return this.connected && this.status === 'revoked';
  }
}

export interface CalendarEventInput {
  title: string;
  notes?: string;
  date: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  busy?: boolean;
}

/** Two days, both included. */
export interface CalendarRange {
  from: string;
  to: string;
}
