import { type CalendarEventResponseDto, heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { CalendarErrors } from './calendar.errors';
import {
  CalendarEventEntity,
  type CalendarEventInput,
  type CalendarRange,
  GoogleCalendarConnectionEntity,
} from './calendar-event.entity';

function toEvent(data: CalendarEventResponseDto): CalendarEventEntity {
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
  async findGoogleConnection(): Promise<GoogleCalendarConnectionEntity> {
    const data = await unwrapBody(
      heyApiSdk.findGoogleCalendarConnection(),
      CalendarErrors.FETCH_GOOGLE_FAILED,
    );
    return new GoogleCalendarConnectionEntity(
      data.connected,
      data.accountEmail ?? null,
      data.status ?? null,
    );
  }

  @MapApiError(CalendarErrors.FETCH_GOOGLE_FAILED)
  async findGoogleEvents(
    range: CalendarRange & { timeZone: string },
  ): Promise<CalendarEventEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findGoogleCalendarEvents({ query: range }),
      CalendarErrors.FETCH_GOOGLE_FAILED,
    );
    return data.map(toEvent);
  }

  /** Google's consent page; the browser goes there. */
  @MapApiError(CalendarErrors.CONNECT_GOOGLE_FAILED)
  async startGoogleConnection(): Promise<string> {
    const data = await unwrapBody(
      heyApiSdk.startGoogleCalendarConnection(),
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
    return new GoogleCalendarConnectionEntity(
      data.connected,
      data.accountEmail ?? null,
      data.status ?? null,
    );
  }

  @MapApiError(CalendarErrors.DISCONNECT_GOOGLE_FAILED)
  async disconnectGoogle(): Promise<void> {
    await unwrap(heyApiSdk.disconnectGoogleCalendar(), CalendarErrors.DISCONNECT_GOOGLE_FAILED);
  }
}
