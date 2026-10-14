/** The account a grant is for, from the ID token on Google's token response. */
export interface CalendarAccount {
  /** Google's `sub`: stable for the account, whatever its address becomes. */
  subject: string;
  email: string;
}

/** What a code exchange gives back: the grant, and whose it is. */
export interface CalendarGrant {
  refreshToken: string | null;
  /** Null when Google sent no usable ID token: the grant is refused, never stored unkeyed. */
  account: CalendarAccount | null;
  scopes: string[];
}

/** The grant a read uses, and the connection it belongs to (its rate-limit bucket). */
export interface CalendarReadGrant {
  connectionId: string;
  refreshToken: string;
}

/** An event as the month view draws it, in the zone it was asked for. */
export interface ProviderCalendarEvent {
  id: string;
  title: string;
  /** `YYYY-MM-DD`. A multi-day all-day event is one item per day. */
  date: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  busy: boolean;
  /** Where the event opens in the provider's own calendar. */
  url: string | null;
  /**
   * The same meeting read from another of the person's accounts carries the same
   * key: its `iCalUID`, its occurrence and, for an all-day item, its day.
   */
  dedupeKey: string;
}

/** One account's events, and the account the refreshed token says it is, when it says. */
export interface ProviderEventsRead {
  events: ProviderCalendarEvent[];
  account: CalendarAccount | null;
}

/** Why a read failed, in the words the handlers act on. */
export class CalendarGrantRevokedError extends Error {}
export class CalendarProviderError extends Error {}

/**
 * A calendar provider, read-only: Google today, Outlook or iCloud as a second
 * adapter (`product/versions/mvp/20-plan-calendar.md` §5).
 *
 * Any call may throw the provider's rate-limit problem (`CALENDAR_010`, an
 * `AppError`) when its quota stopped it; callers let it through as is.
 */
export interface CalendarProviderPort {
  isConfigured(): boolean;
  /**
   * The page a person grants access on, carrying `state`. It always offers the
   * account chooser; `loginHint` opens it on one account (Reconnect).
   */
  authorizationUrl(state: string, loginHint?: string): string;
  /** Throws `CalendarProviderError` when the code is refused. */
  exchange(code: string): Promise<CalendarGrant>;
  /**
   * The events of the account's primary calendar between two days, both
   * included, in `timeZone`. Throws `CalendarGrantRevokedError` when the grant
   * is gone.
   */
  listEvents(
    grant: CalendarReadGrant,
    range: { from: string; to: string; timeZone: string },
  ): Promise<ProviderEventsRead>;
  /** Best effort: a grant Google already dropped is not an error. */
  revoke(grant: CalendarReadGrant): Promise<void>;
}

/** The scope the calendar asks for: read-only, as decided (`17-plan.md`). */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
