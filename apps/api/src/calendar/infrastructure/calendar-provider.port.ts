/** What a code exchange gives back: the grant, and whose it is. */
export interface CalendarGrant {
  refreshToken: string | null;
  accountEmail: string;
  scopes: string[];
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
}

/** Why a read failed, in the words the handlers act on. */
export class CalendarGrantRevokedError extends Error {}
export class CalendarProviderError extends Error {}

/**
 * A calendar provider, read-only: Google today, Outlook or iCloud as a second
 * adapter (`product/versions/mvp/20-plan-calendar.md` §5).
 */
export interface CalendarProviderPort {
  isConfigured(): boolean;
  /** The page a person grants access on, carrying `state`. */
  authorizationUrl(state: string): string;
  /** Throws `CalendarProviderError` when the code is refused. */
  exchange(code: string): Promise<CalendarGrant>;
  /**
   * The events of the primary calendar between two days, both included, in
   * `timeZone`. Throws `CalendarGrantRevokedError` when the grant is gone.
   */
  listEvents(
    refreshToken: string,
    range: { from: string; to: string; timeZone: string },
  ): Promise<ProviderCalendarEvent[]>;
  /** Best effort: a grant Google already dropped is not an error. */
  revoke(refreshToken: string): Promise<void>;
}

/** The scope the calendar asks for: read-only, as decided (`17-plan.md`). */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
