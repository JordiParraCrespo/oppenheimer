'use client';

import { useQuery, useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import { skipToken, type UseQueryOptions, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type {
  CalendarEventEntity,
  CalendarEventInput,
  CalendarRange,
  GoogleCalendarConnectionEntity,
  GoogleCalendarRead,
} from '../modules/calendar/calendar-event.entity';
import { calendarKeys } from './calendar.keys';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

/** How long Google's month stays fresh before a focus reads it again. */
const GOOGLE_FRESH_MS = 2 * 60_000;

/** The workspace's own events for the days on screen; `select` for one of them. */
export function useCalendarEvents<TData = CalendarEventEntity[]>(
  range: CalendarRange,
  options?: Omit<UseQueryOptions<CalendarEventEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CalendarEventEntity[], Error, TData>({
    ...useCalendarEventsQuery(range),
    ...options,
  });
}

/**
 * {@link useCalendarEvents} under a Suspense `QueryState`; `select` for one
 * of them, as there.
 */
export function useSuspenseCalendarEvents<TData = CalendarEventEntity[]>(
  range: CalendarRange,
  select?: (rows: CalendarEventEntity[]) => TData,
) {
  return useSuspenseQuery<CalendarEventEntity[], Error, TData>({
    ...useCalendarEventsQuery(range),
    ...(select ? { select } : {}),
  });
}

/** The month's events read, for both hooks over it: the key and the fetch, once. */
function useCalendarEventsQuery(range: CalendarRange) {
  const app = useConsumerApp();
  return {
    queryKey: calendarKeys.eventRange(range),
    queryFn: () => app.calendar.findEvents(range),
  };
}

/** The viewer's Google accounts, oldest first; `select` for one of them or a count. */
export function useGoogleCalendarConnections<TData = GoogleCalendarConnectionEntity[]>(
  options?: Omit<
    UseQueryOptions<GoogleCalendarConnectionEntity[], Error, TData>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<GoogleCalendarConnectionEntity[], Error, TData>({
    ...useGoogleConnectionsQuery(),
    ...options,
  });
}

/** {@link useGoogleCalendarConnections} for a section under a Suspense `QueryState`. */
export function useSuspenseGoogleCalendarConnections() {
  return useSuspenseQuery<GoogleCalendarConnectionEntity[], Error>(useGoogleConnectionsQuery());
}

/** The Google accounts read, for both hooks over it: the key and the fetch, once. */
function useGoogleConnectionsQuery() {
  const app = useConsumerApp();
  return {
    queryKey: calendarKeys.googleConnections(),
    queryFn: () => app.calendar.findGoogleConnections(),
  };
}

/**
 * Every Google account's events for the days on screen, read through the API
 * and never stored, each meeting once. Asks nothing until `enabled` (an account
 * is active and the layer is on). An account the read found revoked refreshes
 * the account list, which then offers Reconnect.
 */
export function useGoogleCalendarEvents<TData = GoogleCalendarRead>(
  range: CalendarRange,
  timeZone: string,
  enabled: boolean,
  options?: { select?: (read: GoogleCalendarRead) => TData },
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useQuery<GoogleCalendarRead, Error, TData>({
    queryKey: calendarKeys.googleEvents(range, timeZone),
    queryFn: enabled
      ? async () => {
          const read = await app.calendar.findGoogleEvents({ ...range, timeZone });
          if (read.accounts.some((account) => account.status === 'revoked')) {
            void queryClient.invalidateQueries({ queryKey: calendarKeys.googleConnections() });
          }
          return read;
        }
      : skipToken,
    staleTime: GOOGLE_FRESH_MS,
    retry: false,
    ...options,
  });
}

/**
 * The Google read most recently answered, whichever month it was for, and
 * when: what the account list says "Updated 2m ago" from and marks a failing
 * account by. Nothing until a read has answered.
 */
export function useLatestGoogleCalendarRead(): {
  read: GoogleCalendarRead | undefined;
  updatedAt: number;
} {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const latest = () => {
    let newest: { data?: unknown; dataUpdatedAt: number } | undefined;
    for (const query of cache.findAll({ queryKey: calendarKeys.googleReads() })) {
      if (query.state.data && (!newest || query.state.dataUpdatedAt > newest.dataUpdatedAt)) {
        newest = query.state;
      }
    }
    return newest;
  };
  // The query cache: its state objects are replaced on each update, so one is a stable snapshot.
  const state = useSyncExternalStore((onChange) => cache.subscribe(onChange), latest, latest);
  return {
    read: state?.data as GoogleCalendarRead | undefined,
    updatedAt: state?.dataUpdatedAt ?? 0,
  };
}

export const useCreateCalendarEvent = mutation<CalendarEventEntity, CalendarEventInput>({
  run: (app, input) => app.calendar.createEvent(input),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
  },
});

export interface UpdateCalendarEventVariables {
  id: string;
  input: Partial<CalendarEventInput>;
}

export const useUpdateCalendarEvent = mutation<CalendarEventEntity, UpdateCalendarEventVariables>({
  run: (app, { id, input }) => app.calendar.updateEvent(id, input),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
  },
});

export const useDeleteCalendarEvent = mutation<void, string>({
  run: (app, id) => app.calendar.removeEvent(id),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
  },
});

/**
 * Asks for Google's consent page and sends the browser there: a new account,
 * or, given a connection's id, a reconnect of that one.
 */
export const useStartGoogleCalendarConnection = mutation<string, string | undefined>({
  run: (app, connectionId) => app.calendar.startGoogleConnection(connectionId),
  update: (_queryClient, url) => {
    window.location.assign(url);
  },
});

export const useConnectGoogleCalendar = mutation<
  GoogleCalendarConnectionEntity,
  { code: string; state: string }
>({
  run: (app, { code, state }) => app.calendar.connectGoogle(code, state),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.google() });
  },
});

/** Removes one Google account: its events leave the month and its colour is free again. */
export const useRemoveGoogleCalendarConnection = mutation<void, string>({
  run: (app, id) => app.calendar.removeGoogleConnection(id),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.google() });
  },
});
