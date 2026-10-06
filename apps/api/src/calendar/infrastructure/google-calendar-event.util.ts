import type { ProviderCalendarEvent } from './calendar-provider.port';

/** The parts of a Google Calendar event the month view reads. */
interface GoogleEventTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  id?: string;
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
      date,
      allDay: false,
      startTime,
      endTime: endTime > startTime ? endTime : '23:59',
    });
  }
  return out;
}

/** The `email` claim of an ID token Google returned on its own token endpoint, over TLS. */
export function emailOfIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  const [, payload] = idToken.split('.');
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown;
    };
    return typeof claims.email === 'string' ? claims.email : null;
  } catch {
    return null;
  }
}
