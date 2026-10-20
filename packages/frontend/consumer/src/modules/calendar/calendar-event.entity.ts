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
    /** The Google account a Google event was read from; null for a personal one. */
    public readonly connectionId: string | null = null,
    /** Where to join a Google event's video meeting (Meet, Zoom, Teams…), when it has one. */
    public readonly meetingUrl: string | null = null,
  ) {}

  get isEditable(): boolean {
    return this.source === 'personal';
  }
}

/**
 * One of the caller's Google accounts (`23-plan-milestones-stats-accounts.md`
 * §5): up to five, each with the colour the month draws its events in.
 */
export class GoogleCalendarConnectionEntity {
  constructor(
    public readonly id: string,
    public readonly accountEmail: string,
    public readonly status: 'active' | 'revoked',
    /** 0–4, picked when it was connected and never reassigned. */
    public readonly colorIndex: number,
    public readonly connectedAt: string,
  ) {}

  /** Google still honours the grant. */
  get isActive(): boolean {
    return this.status === 'active';
  }

  /** Google dropped the grant: the account offers Reconnect. */
  get needsReconnect(): boolean {
    return this.status === 'revoked';
  }
}

/** How one account's read went: `revoked` asks to reconnect, `error` to retry. */
export type GoogleAccountReadStatus = 'ok' | 'revoked' | 'error';

/** Every account's events for the days on screen, each meeting once, and how each account went. */
export interface GoogleCalendarRead {
  events: CalendarEventEntity[];
  accounts: { id: string; status: GoogleAccountReadStatus }[];
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
