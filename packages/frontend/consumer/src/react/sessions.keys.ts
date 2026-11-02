'use client';

/**
 * A session's share sits beside `details()`, not under `detail(id)`: sharing
 * raises no `session.changed`, so a row's every change would refetch it for
 * nothing.
 */
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: () => [...sessionsKeys.lists()] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string | undefined) => [...sessionsKeys.details(), id] as const,
  start: (id: string | undefined, failed: boolean) =>
    [...sessionsKeys.detail(id), 'start', { failed }] as const,
  share: (id: string) => [...sessionsKeys.all, 'share', id] as const,
  shared: (slug: string | undefined) => [...sessionsKeys.all, 'shared', slug] as const,
  ports: (id: string) => [...sessionsKeys.all, 'ports', id] as const,
  preview: (id: string, port: number, opened: number) =>
    [...sessionsKeys.all, 'preview', id, port, opened] as const,
};
