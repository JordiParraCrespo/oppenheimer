import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/** Client-side fallbacks, used only when the API answered with no problem document. */
export const CalendarErrors = {
  FETCH_EVENTS_FAILED: { code: 'CALENDAR_CLIENT_001', message: 'Failed to load the calendar' },
  SAVE_EVENT_FAILED: { code: 'CALENDAR_CLIENT_002', message: 'Failed to save the event' },
  DELETE_EVENT_FAILED: { code: 'CALENDAR_CLIENT_003', message: 'Failed to delete the event' },
  FETCH_GOOGLE_FAILED: { code: 'CALENDAR_CLIENT_004', message: 'Failed to load Google Calendar' },
  CONNECT_GOOGLE_FAILED: {
    code: 'CALENDAR_CLIENT_005',
    message: 'Failed to connect Google Calendar',
  },
  DISCONNECT_GOOGLE_FAILED: {
    code: 'CALENDAR_CLIENT_006',
    message: 'Failed to disconnect Google Calendar',
  },
} as const satisfies Record<string, ErrorDefinition>;
