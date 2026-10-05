'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CalendarEventEntity,
  CalendarEventInput,
  CalendarRange,
  GoogleCalendarConnectionEntity,
} from '../modules/calendar/calendar-event.entity';
import { useConsumerApp } from './context';

export const calendarKeys = {
  all: ['calendar'] as const,
  events: () => [...calendarKeys.all, 'events'] as const,
  eventRange: (range: CalendarRange) => [...calendarKeys.events(), range] as const,
  google: () => [...calendarKeys.all, 'google'] as const,
  googleConnection: () => [...calendarKeys.google(), 'connection'] as const,
  googleEvents: (range: CalendarRange, timeZone: string) =>
    [...calendarKeys.google(), 'events', range, timeZone] as const,
};

/** How long Google's month stays fresh before a focus reads it again. */
const GOOGLE_FRESH_MS = 2 * 60_000;

/** The workspace's own events for the days on screen; `select` for one of them. */
export function useCalendarEvents<TData = CalendarEventEntity[]>(
  range: CalendarRange,
  options?: Omit<UseQueryOptions<CalendarEventEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<CalendarEventEntity[], Error, TData>({
    queryKey: calendarKeys.eventRange(range),
    queryFn: () => app.calendar.findEvents(range),
    ...options,
  });
}

export function useGoogleCalendarConnection() {
  const app = useConsumerApp();
  return useQuery({
    queryKey: calendarKeys.googleConnection(),
    queryFn: () => app.calendar.findGoogleConnection(),
  });
}

/**
 * The viewer's Google Calendar for the days on screen, read through the API and
 * never stored. Asks nothing until the connection is active.
 */
export function useGoogleCalendarEvents(
  range: CalendarRange,
  timeZone: string,
  connection: GoogleCalendarConnectionEntity | undefined,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: calendarKeys.googleEvents(range, timeZone),
    queryFn: connection?.isActive
      ? async () => {
          try {
            return await app.calendar.findGoogleEvents({ ...range, timeZone });
          } catch (error) {
            // A revoked grant shows on the connection card as Reconnect.
            void queryClient.invalidateQueries({ queryKey: calendarKeys.googleConnection() });
            throw error;
          }
        }
      : skipToken,
    staleTime: GOOGLE_FRESH_MS,
    retry: false,
  });
}

export function useCreateCalendarEvent(
  options?: UseMutationOptions<CalendarEventEntity, Error, CalendarEventInput>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarEventInput) => app.calendar.createEvent(input),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    }),
  });
}

export interface UpdateCalendarEventVariables {
  id: string;
  input: Partial<CalendarEventInput>;
}

export function useUpdateCalendarEvent(
  options?: UseMutationOptions<CalendarEventEntity, Error, UpdateCalendarEventVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateCalendarEventVariables) =>
      app.calendar.updateEvent(id, input),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    }),
  });
}

export function useDeleteCalendarEvent(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.calendar.removeEvent(id),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    }),
  });
}

/** Asks for Google's consent page and sends the browser there. */
export function useStartGoogleCalendarConnection(
  options?: UseMutationOptions<string, Error, void>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: () => app.calendar.startGoogleConnection(),
    ...withCacheOnSuccess(options, (url) => {
      window.location.assign(url);
    }),
  });
}

export function useConnectGoogleCalendar(
  options?: UseMutationOptions<
    GoogleCalendarConnectionEntity,
    Error,
    { code: string; state: string }
  >,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      app.calendar.connectGoogle(code, state),
    ...withCacheOnSuccess(options, (connection) => {
      queryClient.setQueryData(calendarKeys.googleConnection(), connection);
      void queryClient.invalidateQueries({ queryKey: calendarKeys.google() });
    }),
  });
}

export function useDisconnectGoogleCalendar(options?: UseMutationOptions<void, Error, void>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => app.calendar.disconnectGoogle(),
    ...withCacheOnSuccess(options, () => {
      queryClient.removeQueries({ queryKey: calendarKeys.google() });
      void queryClient.invalidateQueries({ queryKey: calendarKeys.googleConnection() });
    }),
  });
}
