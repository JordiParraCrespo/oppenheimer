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

/**
 * A range of days, both ends included. A plain object, so the query parameters
 * reach the OpenAPI document; the API refuses a backwards or too-wide range
 * itself (`CALENDAR_003`).
 */
export const calendarRangeQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
});

export type CalendarRangeQueryDto = z.infer<typeof calendarRangeQuerySchema>;

/** `GET /calendar/google/events`: the range, and the zone to read Google's times in. */
export const googleCalendarEventsQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  timeZone: z.string().min(1).max(64),
});

export type GoogleCalendarEventsQueryDto = z.infer<typeof googleCalendarEventsQuerySchema>;

/** `POST /calendar/google/connection`: what Google put on the redirect. */
export const connectGoogleCalendarSchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});

export type ConnectGoogleCalendarDto = z.infer<typeof connectGoogleCalendarSchema>;

/**
 * Several Google accounts per person (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §5): at most this many connections, and one colour per connection, from the
 * lowest index none of the person's others holds.
 */
export const GOOGLE_CALENDAR_ACCOUNTS_MAX = 5;

/**
 * `POST /calendar/google/connections`: start connecting an account, or, with a
 * `connectionId`, reconnect that one (Google's account chooser opens on it).
 */
export const startGoogleCalendarConnectionSchema = z.object({
  connectionId: z.string().uuid().optional(),
});

export type StartGoogleCalendarConnectionDto = z.infer<typeof startGoogleCalendarConnectionSchema>;

/** One of the caller's Google accounts, as the sidebar lists it. */
export const googleCalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  accountEmail: z.string(),
  status: z.enum(['active', 'revoked']),
  colorIndex: z
    .number()
    .int()
    .min(0)
    .max(GOOGLE_CALENDAR_ACCOUNTS_MAX - 1),
  connectedAt: z.string(),
});

export type GoogleCalendarConnection = z.infer<typeof googleCalendarConnectionSchema>;

/** How one account's read went: `revoked` asks to reconnect, `error` to retry. */
export const googleCalendarAccountReadStatusSchema = z.enum(['ok', 'revoked', 'error']);

export type GoogleCalendarAccountReadStatus = z.infer<typeof googleCalendarAccountReadStatusSchema>;
