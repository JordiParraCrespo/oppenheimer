import type { CalendarAccount, ProviderCalendarEvent } from './calendar-provider.port';

/** The parts of a Google Calendar event the month view reads. */
interface GoogleEventTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  id?: string;
  iCalUID?: string;
  /** Set on an instance of a recurring event: when this occurrence was scheduled to start. */
  originalStartTime?: GoogleEventTime;
  status?: string;
  summary?: string;
  transparency?: string;
  htmlLink?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
}

function asEvents(input: unknown): GoogleEvent[] {
  const items = (input as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as GoogleEvent[]) : [];
}

/** The next calendar day of `YYYY-MM-DD`. */
export function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * A point in time as one key, whichever zone it was written in: two accounts
 * may answer the same instant with different offsets.
 */
function instantOf(time: GoogleEventTime | undefined): string {
  if (time?.dateTime) {
    const ms = Date.parse(time.dateTime);
    return Number.isNaN(ms) ? time.dateTime : new Date(ms).toISOString();
  }
  return time?.date ?? '';
}

/**
 * What makes two accounts' copies of one meeting the same item: the meeting's
 * `iCalUID` (shared by every invitee's copy, and by every instance of a
 * recurring one) and which occurrence this is.
 */
function occurrenceKey(event: GoogleEvent): string {
  return `${event.iCalUID ?? event.id}|${instantOf(event.originalStartTime ?? event.start)}`;
}

/**
 * Google's page of events, already in the zone it was asked for, as the month view
 * draws them: cancelled ones dropped, an all-day event spanning days as one item per
 * day of the range, and a timed one on its start day, ending at 23:59 when it runs
 * past midnight.
 */
export function googleEventsToProvider(
  page: unknown,
  range: { from: string; to: string },
): ProviderCalendarEvent[] {
  const out: ProviderCalendarEvent[] = [];
  for (const event of asEvents(page)) {
    if (!event.id || event.status === 'cancelled' || !event.start) continue;
    const key = occurrenceKey(event);
    const base = {
      title: event.summary ?? '',
      busy: event.transparency !== 'transparent',
      url: event.htmlLink ?? null,
    };
    if (event.start.date) {
      const end = event.end?.date ?? nextDay(event.start.date);
      for (let day = event.start.date; day < end; day = nextDay(day)) {
        if (day < range.from || day > range.to) continue;
        out.push({
          ...base,
          id: `${event.id}:${day}`,
          dedupeKey: `${key}|${day}`,
          date: day,
          allDay: true,
          startTime: null,
          endTime: null,
        });
      }
      continue;
    }
    if (!event.start.dateTime) continue;
    const date = event.start.dateTime.slice(0, 10);
    if (date < range.from || date > range.to) continue;
    const startTime = event.start.dateTime.slice(11, 16);
    const endsSameDay = event.end?.dateTime?.slice(0, 10) === date;
    const endTime = endsSameDay ? (event.end?.dateTime?.slice(11, 16) ?? startTime) : '23:59';
    out.push({
      ...base,
      id: event.id,
      dedupeKey: key,
      date,
      allDay: false,
      startTime,
      endTime: endTime > startTime ? endTime : '23:59',
    });
  }
  return out;
}

/**
 * The account an ID token names: its `sub` and `email` claims. Read without
 * checking the signature, which is sound only because the token came straight
 * from Google's own token endpoint over TLS, in answer to our client's request
 * (OpenID Connect Core §3.1.3.7); never call this on a token a browser handed
 * us.
 */
export function accountOfIdToken(idToken: unknown): CalendarAccount | null {
  if (typeof idToken !== 'string') return null;
  const [, payload] = idToken.split('.');
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims !== 'object' || claims === null) return null;
    const { sub, email } = claims as Record<string, unknown>;
    return typeof sub === 'string' && sub && typeof email === 'string' && email
      ? { subject: sub, email }
      : null;
  } catch {
    return null;
  }
}
