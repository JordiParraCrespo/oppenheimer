'use client';

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { automationsKeys } from './automations.queries';
import { useConsumerApp } from './context';
import { hostsKeys } from './hosts.queries';
import { LIVE_POLL, type LivePollKind, setStreamedPolls } from './live-poll';
import { sessionsKeys } from './sessions.queries';

/** Every poll the stream stands in for while it is live. */
const STREAMED = Object.keys(LIVE_POLL) as LivePollKind[];

/**
 * Refetch what one change touched: the reads that already exist for it, at
 * their own keys. A pairing detail is never named, since its `queryFn` mints
 * a new token (`hostsKeys`).
 */
function invalidateFor(queryClient: QueryClient, event: WorkspaceEvent): void {
  switch (event.type) {
    case 'session.changed':
      // The detail's prefix holds its start log too, so a landed step redraws the stepper.
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(event.id) });
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      return;
    case 'host.changed':
      void queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
      return;
    case 'pairing.spent':
      void queryClient.invalidateQueries({ queryKey: hostsKeys.pairingLists() });
      void queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
      return;
    case 'automationRun.changed':
      void queryClient.invalidateQueries({ queryKey: automationsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: automationsKeys.runs() });
      if (event.automationId) {
        void queryClient.invalidateQueries({
          queryKey: automationsKeys.detail(event.automationId),
        });
      }
      return;
  }
}

/**
 * Refetch everything the stream covers: what a gap in it may have missed.
 * One refetch per open screen, as a window refocus does; a closed screen's
 * queries are only marked stale.
 */
function invalidateCovered(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
  void queryClient.invalidateQueries({ queryKey: hostsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: hostsKeys.pairingLists() });
  void queryClient.invalidateQueries({ queryKey: automationsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: automationsKeys.details() });
  void queryClient.invalidateQueries({ queryKey: automationsKeys.runs() });
}

/**
 * The workspace's change feed, for as long as the console is mounted and the
 * `workspace_event_stream` flag is on: one stream per tab, whose events
 * refetch the queries they name.
 *
 * Live, every poll in `LIVE_POLL` stands down. On every change of state the
 * covered queries are refetched: going live catches what happened before the
 * stream subscribed, and going down is the read that brings each poll back.
 * It renders nothing and re-renders nothing; the state it keeps is the
 * polls'.
 */
export function useWorkspaceEvents(): void {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const enabled = useFeatureFlag('workspace_event_stream');

  // Subscribes to the API's event stream, an outside system, for as long as the flag is on.
  useEffect(() => {
    if (!enabled) return;
    const stream = app.organizations.openEvents();
    let live = false;
    const offStatus = stream.onStatus((status) => {
      const next = status === 'live';
      if (next === live) return;
      live = next;
      setStreamedPolls(next ? STREAMED : []);
      invalidateCovered(queryClient);
    });
    const offEvent = stream.onEvent((event) => invalidateFor(queryClient, event));
    return () => {
      offStatus();
      offEvent();
      stream.dispose();
      if (live) {
        setStreamedPolls([]);
        invalidateCovered(queryClient);
      }
    };
  }, [app, queryClient, enabled]);
}
