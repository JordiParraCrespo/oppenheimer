import {
  type CalendarEventResponseDto,
  type GoogleCalendarConnectionResponseDto,
  type GoogleCalendarEventResponseDto,
  heyApiSdk,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { CalendarErrors } from './calendar.errors';
import {
  CalendarEventEntity,
  type CalendarEventInput,
  type CalendarRange,
  GoogleCalendarConnectionEntity,
  type GoogleCalendarRead,
} from './calendar-event.entity';

function toConnection(data: GoogleCalendarConnectionResponseDto): GoogleCalendarConnectionEntity {
  return new GoogleCalendarConnectionEntity(
    data.id,
    data.accountEmail,
    data.status,
    data.colorIndex,
    data.connectedAt,
  );
}

function toEvent(
  data: CalendarEventResponseDto | GoogleCalendarEventResponseDto,
): CalendarEventEntity {
  return new CalendarEventEntity(
    data.id,
    data.source,
    data.title,
    data.notes,
    data.date,
    data.allDay,
    data.startTime ?? null,
    data.endTime ?? null,
    data.busy,
    data.url ?? null,
    'connectionId' in data ? data.connectionId : null,
    data.meetingUrl ?? null,
  );
}

@injectable()
export class CalendarRepository {
  @MapApiError(CalendarErrors.FETCH_EVENTS_FAILED)
  async findEvents(range: CalendarRange): Promise<CalendarEventEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findCalendarEvents({ query: range }),
      CalendarErrors.FETCH_EVENTS_FAILED,
    );
    return data.map(toEvent);
  }

  @MapApiError(CalendarErrors.SAVE_EVENT_FAILED)
  async createEvent(input: CalendarEventInput): Promise<CalendarEventEntity> {
    const data = await unwrapBody(
      heyApiSdk.createCalendarEvent({ body: { busy: true, ...input } }),
      CalendarErrors.SAVE_EVENT_FAILED,
    );
    return toEvent(data);
  }

  @MapApiError(CalendarErrors.SAVE_EVENT_FAILED)
  async updateEvent(id: string, input: Partial<CalendarEventInput>): Promise<CalendarEventEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateCalendarEvent({ path: { id }, body: input }),
      CalendarErrors.SAVE_EVENT_FAILED,
    );
    return toEvent(data);
  }

  @MapApiError(CalendarErrors.DELETE_EVENT_FAILED)
  async removeEvent(id: string): Promise<void> {
    await unwrap(
      heyApiSdk.deleteCalendarEvent({ path: { id } }),
      CalendarErrors.DELETE_EVENT_FAILED,
    );
  }

  @MapApiError(CalendarErrors.FETCH_GOOGLE_FAILED)
  async findGoogleConnections(): Promise<GoogleCalendarConnectionEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findGoogleCalendarConnections(),
      CalendarErrors.FETCH_GOOGLE_FAILED,
    );
    return data.map(toConnection);
  }

  @MapApiError(CalendarErrors.FETCH_GOOGLE_FAILED)
  async findGoogleEvents(range: CalendarRange & { timeZone: string }): Promise<GoogleCalendarRead> {
    const data = await unwrapBody(
      heyApiSdk.findGoogleCalendarEvents({ query: range }),
      CalendarErrors.FETCH_GOOGLE_FAILED,
    );
    return {
      events: data.events.map(toEvent),
      accounts: data.accounts.map(({ id, status }) => ({ id, status })),
    };
  }

  /** Google's consent page, for a new account or to reconnect one; the browser goes there. */
  @MapApiError(CalendarErrors.CONNECT_GOOGLE_FAILED)
  async startGoogleConnection(connectionId?: string): Promise<string> {
    const data = await unwrapBody(
      heyApiSdk.startGoogleCalendarConnection({ body: connectionId ? { connectionId } : {} }),
      CalendarErrors.CONNECT_GOOGLE_FAILED,
    );
    return data.url;
  }

  @MapApiError(CalendarErrors.CONNECT_GOOGLE_FAILED)
  async connectGoogle(code: string, state: string): Promise<GoogleCalendarConnectionEntity> {
    const data = await unwrapBody(
      heyApiSdk.connectGoogleCalendar({ body: { code, state } }),
      CalendarErrors.CONNECT_GOOGLE_FAILED,
    );
    return toConnection(data);
  }

  @MapApiError(CalendarErrors.REMOVE_GOOGLE_FAILED)
  async removeGoogleConnection(id: string): Promise<void> {
    await unwrap(
      heyApiSdk.removeGoogleCalendarConnection({ path: { id } }),
      CalendarErrors.REMOVE_GOOGLE_FAILED,
    );
  }
}
