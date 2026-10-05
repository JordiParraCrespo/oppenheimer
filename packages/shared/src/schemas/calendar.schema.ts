import { z } from 'zod';
import { calendarDateSchema, timeOfDaySchema } from './task.schema.js';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`). Events are
 * wall-clock, like a task's due date: a day, and a start and an end on it, read
 * in the viewer's timezone. Google's events come back in the zone the console
 * asks for, so both layers draw the same way.
 */

export const CALENDAR_EVENT_TITLE_MAX = 500;
export const CALENDAR_EVENT_NOTES_MAX = 10_000;
/** The widest range one read covers: a month view with a week each side, and slack. */
export const CALENDAR_RANGE_MAX_DAYS = 62;

const titleSchema = z.string().trim().min(1).max(CALENDAR_EVENT_TITLE_MAX);

function timesFitTheDay(value: {
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
}): boolean {
  if (value.allDay) return !value.startTime && !value.endTime;
  return Boolean(value.startTime && value.endTime && value.endTime > value.startTime);
}

/** `POST /calendar/events`: a personal event, all day or from a start to an end. */
export const createCalendarEventSchema = z
  .object({
    title: titleSchema,
    notes: z.string().max(CALENDAR_EVENT_NOTES_MAX).optional(),
    date: calendarDateSchema,
    allDay: z.boolean(),
    startTime: timeOfDaySchema.nullable().optional(),
    endTime: timeOfDaySchema.nullable().optional(),
    busy: z.boolean().default(true),
  })
  .refine(timesFitTheDay, { path: ['endTime'] });

export type CreateCalendarEventDto = z.infer<typeof createCalendarEventSchema>;

/**
 * `PATCH /calendar/events/{id}`. Every field optional; what is sent is checked
 * with what is kept, so an end before the kept start is refused by the server.
 */
export const updateCalendarEventSchema = z.object({
  title: titleSchema.optional(),
  notes: z.string().max(CALENDAR_EVENT_NOTES_MAX).optional(),
  date: calendarDateSchema.optional(),
  allDay: z.boolean().optional(),
  startTime: timeOfDaySchema.nullable().optional(),
  endTime: timeOfDaySchema.nullable().optional(),
  busy: z.boolean().optional(),
});

export type UpdateCalendarEventDto = z.infer<typeof updateCalendarEventSchema>;

/** A range of days, both ends included. */
export const calendarRangeQuerySchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .refine((value) => value.to >= value.from, { path: ['to'] });

export type CalendarRangeQueryDto = z.infer<typeof calendarRangeQuerySchema>;

/** `GET /calendar/google/events`: the range, and the zone to read Google's times in. */
export const googleCalendarEventsQuerySchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
    timeZone: z.string().min(1).max(64),
  })
  .refine((value) => value.to >= value.from, { path: ['to'] });

export type GoogleCalendarEventsQueryDto = z.infer<typeof googleCalendarEventsQuerySchema>;

/** `POST /calendar/google/connection`: what Google put on the redirect. */
export const connectGoogleCalendarSchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});

export type ConnectGoogleCalendarDto = z.infer<typeof connectGoogleCalendarSchema>;
