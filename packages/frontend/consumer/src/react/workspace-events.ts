'use client';

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { automationsKeys } from './automations.queries';
import { useConsumerApp } from './context';
import { hostsKeys } from './hosts.queries';
import { sessionsKeys } from './sessions.queries';
import { setWorkspaceStream } from './workspace-stream-status';

/**
 * The reads a change touches, at the keys they already have. A pairing
 * detail is never named: its `queryFn` mints a new token (`hostsKeys`).
 */
function keysFor(event: WorkspaceEvent): readonly (readonly unknown[])[] {
  switch (event.type) {
    case 'session.changed':
      // The detail's prefix holds its start log. A host's status and running
      // count are read from its sessions, so the host list moves with them.
      return [sessionsKeys.detail(event.id), sessionsKeys.lists(), hostsKeys.lists()];
    case 'host.changed':
      return [hostsKeys.lists()];
    case 'pairing.spent':
      return [hostsKeys.pairingLists(), hostsKeys.lists()];
    case 'automationRun.changed':
      return [
        automationsKeys.lists(),
        automationsKeys.runs(),
        automationsKeys.detail(event.automationId),
      ];
  }
}

/**
 * What the stream covers, and the one table that says so: each time it comes
 * up, every key here is refetched once for what the gap may have missed, and
 * while it is live the polls under a key that `pollStandsDown` stand down
 * (`usePollWhile`).
 *
 * - Sessions: the list, each detail and its start log. Every write that lands
 *   a start step raises `session.changed`, so the stepper moves on it too.
 * - Pairing lists: `pairing.spent` is the token being spent.
 * - The host list catches up but keeps its poll: presence is a heartbeat the
 *   stream does not carry.
 * - Automations catch up but keep the run poll: a run's status follows its
 *   session, and `session.changed` does not name automation reads.
 */
const COVERAGE: readonly { key: QueryKey; pollStandsDown: boolean }[] = [
  { key: sessionsKeys.all, pollStandsDown: true },
  { key: hostsKeys.pairingLists(), pollStandsDown: true },
  { key: hostsKeys.lists(), pollStandsDown: false },
  { key: automationsKeys.lists(), pollStandsDown: false },
  { key: automationsKeys.details(), pollStandsDown: false },
  { key: automationsKeys.runs(), pollStandsDown: false },
];

const CATCH_UP = COVERAGE.map((entry) => entry.key);
const STANDS_DOWN = COVERAGE.filter((entry) => entry.pollStandsDown).map((entry) => entry.key);

function startsWith(queryKey: QueryKey, prefix: QueryKey): boolean {
  return prefix.every((part, index) => Object.is(part, queryKey[index]));
}

/** Whether the stream announces every change to `queryKey`, so its poll may stand down. */
function covers(queryKey: QueryKey): boolean {
  return STANDS_DOWN.some((prefix) => startsWith(queryKey, prefix));
}

function invalidate(queryClient: QueryClient, keys: readonly (readonly unknown[])[]): void {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

/**
 * The workspace's change feed, while `workspaceId` names one and the
 * `workspace_event_stream` flag is on: one stream per tab, whose events
 * refetch the queries they name the moment the change commits.
 *
 * While it is live, the polls whose facts it carries stand down
 * (`usePollWhile`); the moment it is not, they poll again. Each time
 * it comes up — the first connect included, since a change can land between a
 * screen's read and the subscription — the covered queries are refetched
 * once, for what the gap may have missed. A flag read off, or a workspace that
 * changes, closes the stream.
 */
export function useWorkspaceEvents(workspaceId: string | undefined): void {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const enabled = useFeatureFlag('workspace_event_stream');

  // Subscribes to the API's event stream, an outside system, while the flag and a workspace hold.
  useEffect(() => {
    if (!enabled || !workspaceId) return;
    const stream = app.organizations.openEvents();
    let live = false;
    const offStatus = stream.onStatus((status) => {
      const now = status === 'live';
      if (now && !live) invalidate(queryClient, CATCH_UP);
      live = now;
      setWorkspaceStream(queryClient, now, covers);
    });
    const offEvent = stream.onEvent((event) => invalidate(queryClient, keysFor(event)));
    return () => {
      offStatus();
      offEvent();
      stream.dispose();
      setWorkspaceStream(queryClient, false, covers);
    };
  }, [app, queryClient, enabled, workspaceId]);
}
