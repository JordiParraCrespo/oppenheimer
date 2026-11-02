'use client';

import type { CalendarRange } from '../modules/calendar/calendar-event.entity';

export const calendarKeys = {
  all: ['calendar'] as const,
  events: () => [...calendarKeys.all, 'events'] as const,
  eventRange: (range: CalendarRange) => [...calendarKeys.events(), range] as const,
  google: () => [...calendarKeys.all, 'google'] as const,
  googleConnections: () => [...calendarKeys.google(), 'connections'] as const,
  googleReads: () => [...calendarKeys.google(), 'events'] as const,
  googleEvents: (range: CalendarRange, timeZone: string) =>
    [...calendarKeys.googleReads(), range, timeZone] as const,
};
