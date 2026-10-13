'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type {
  CalendarEventEntity,
  CalendarEventInput,
  CalendarRange,
  GoogleCalendarConnectionEntity,
  GoogleCalendarRead,
} from '../modules/calendar/calendar-event.entity';
import { useConsumerApp } from './context';

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

/** The viewer's Google accounts, oldest first; `select` for one of them or a count. */
export function useGoogleCalendarConnections<TData = GoogleCalendarConnectionEntity[]>(
  options?: Omit<
    UseQueryOptions<GoogleCalendarConnectionEntity[], Error, TData>,
    'queryKey' | 'queryFn'
  >,
) {
  const app = useConsumerApp();
  return useQuery<GoogleCalendarConnectionEntity[], Error, TData>({
    queryKey: calendarKeys.googleConnections(),
    queryFn: () => app.calendar.findGoogleConnections(),
    ...options,
  });
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

/**
 * Asks for Google's consent page and sends the browser there: a new account,
 * or, given a connection's id, a reconnect of that one.
 */
export function useStartGoogleCalendarConnection(
  options?: UseMutationOptions<string, Error, string | undefined>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (connectionId?: string) => app.calendar.startGoogleConnection(connectionId),
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
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.google() });
    }),
  });
}

/** Removes one Google account: its events leave the month and its colour is free again. */
export function useRemoveGoogleCalendarConnection(
  options?: UseMutationOptions<void, Error, string>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.calendar.removeGoogleConnection(id),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.google() });
    }),
  });
}
