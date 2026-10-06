'use client';

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { automationsKeys } from './automations.queries';
import { useConsumerApp } from './context';
import { hostsKeys } from './hosts.queries';
import { sessionsKeys } from './sessions.queries';

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

/** Everything a gap in the stream may have missed: one refetch per open screen. */
const COVERED = [
  sessionsKeys.all,
  hostsKeys.lists(),
  hostsKeys.pairingLists(),
  automationsKeys.lists(),
  automationsKeys.details(),
  automationsKeys.runs(),
];

function invalidate(queryClient: QueryClient, keys: readonly (readonly unknown[])[]): void {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

/**
 * The workspace's change feed, while `workspaceId` names one and the
 * `workspace_event_stream` flag is on: one stream per tab, whose events
 * refetch the queries they name the moment the change commits.
 *
 * It sits beside the polls in `LIVE_POLL`, which run as they always do: the
 * stream makes a change arrive sooner, never later. After a reconnect the
 * covered queries are refetched once, for what the gap may have missed. A
 * flag read off, or a workspace that changes, closes the stream.
 */
export function useWorkspaceEvents(workspaceId: string | undefined): void {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const enabled = useFeatureFlag('workspace_event_stream');

  // Subscribes to the API's event stream, an outside system, while the flag and a workspace hold.
  useEffect(() => {
    if (!enabled || !workspaceId) return;
    const stream = app.organizations.openEvents();
    // Live once already, then down: the next `live` is a reconnect.
    let wasLive = false;
    let dropped = false;
    const offStatus = stream.onStatus((status) => {
      if (status !== 'live') {
        dropped = wasLive;
        return;
      }
      if (dropped) invalidate(queryClient, COVERED);
      wasLive = true;
      dropped = false;
    });
    const offEvent = stream.onEvent((event) => invalidate(queryClient, keysFor(event)));
    return () => {
      offStatus();
      offEvent();
      stream.dispose();
    };
  }, [app, queryClient, enabled, workspaceId]);
}
