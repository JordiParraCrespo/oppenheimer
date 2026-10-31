import {
  type CalendarEventResponseDto,
  type GoogleCalendarConnectionResponseDto,
  type GoogleCalendarEventResponseDto,
  heyApiSdk,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  findEvents(range: CalendarRange): Promise<CalendarEventEntity[]> {
    return callApi(CalendarErrors.FETCH_EVENTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findCalendarEvents({ query: range }));
      return data.map(toEvent);
    });
  }

  createEvent(input: CalendarEventInput): Promise<CalendarEventEntity> {
    return callApi(CalendarErrors.SAVE_EVENT_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.createCalendarEvent({ body: { busy: true, ...input } }),
      );
      return toEvent(data);
    });
  }

  updateEvent(id: string, input: Partial<CalendarEventInput>): Promise<CalendarEventEntity> {
    return callApi(CalendarErrors.SAVE_EVENT_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.updateCalendarEvent({ path: { id }, body: input }));
      return toEvent(data);
    });
  }

  removeEvent(id: string): Promise<void> {
    return callApi(CalendarErrors.DELETE_EVENT_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteCalendarEvent({ path: { id } }));
    });
  }

  findGoogleConnections(): Promise<GoogleCalendarConnectionEntity[]> {
    return callApi(CalendarErrors.FETCH_GOOGLE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findGoogleCalendarConnections());
      return data.map(toConnection);
    });
  }

  findGoogleEvents(range: CalendarRange & { timeZone: string }): Promise<GoogleCalendarRead> {
    return callApi(CalendarErrors.FETCH_GOOGLE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findGoogleCalendarEvents({ query: range }));
      return {
        events: data.events.map(toEvent),
        accounts: data.accounts.map(({ id, status }) => ({ id, status })),
      };
    });
  }

  /** Google's consent page, for a new account or to reconnect one; the browser goes there. */
  startGoogleConnection(connectionId?: string): Promise<string> {
    return callApi(CalendarErrors.CONNECT_GOOGLE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.startGoogleCalendarConnection({ body: connectionId ? { connectionId } : {} }),
      );
      return data.url;
    });
  }

  connectGoogle(code: string, state: string): Promise<GoogleCalendarConnectionEntity> {
    return callApi(CalendarErrors.CONNECT_GOOGLE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.connectGoogleCalendar({ body: { code, state } }));
      return toConnection(data);
    });
  }

  removeGoogleConnection(id: string): Promise<void> {
    return callApi(CalendarErrors.REMOVE_GOOGLE_FAILED, async (api) => {
      await api.result(heyApiSdk.removeGoogleCalendarConnection({ path: { id } }));
    });
  }
}
