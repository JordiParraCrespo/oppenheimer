'use client';

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { automationsKeys } from './automations.queries';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';
import { hostsKeys } from './hosts.queries';
import { inboxKeys } from './inbox.keys';
import { pullRequestsKeys } from './pull-requests.queries';
import { sessionsKeys } from './sessions.queries';
import { tasksKeys } from './tasks.queries';
import { setWorkspaceStream } from './workspace-stream-status';

/**
 * One read an event refreshes: its key for this event, the prefix every key
 * of that read shares, and whether the event is announced for **every**
 * change to that read. Only then may the read's poll stand down while the
 * stream is live (`usePollWhile`, and only for a poll kind that opts in); a
 * read the event merely touches catches up on it and keeps its poll.
 */
interface Refresh<E> {
  readonly prefix: QueryKey;
  readonly key?: (event: E) => QueryKey;
  readonly announcesEvery: boolean;
  /** Left out of the catch-up when the stream comes up; on by default. */
  readonly catchUp?: false;
}

type EventOf<T extends WorkspaceEvent['type']> = Extract<WorkspaceEvent, { type: T }>;
type RefreshTable = { readonly [T in WorkspaceEvent['type']]: readonly Refresh<EventOf<T>>[] };

/**
 * What a session's change touches. The detail's prefix holds its start log.
 * A host's status and running count are read from its sessions, so the host
 * list moves with them, and so does For review: a review session is a
 * session, and a close its host refused puts it back there.
 */
const SESSION_CHANGED: readonly Refresh<{ id: string }>[] = [
  { prefix: sessionsKeys.details(), key: (e) => sessionsKeys.detail(e.id), announcesEvery: true },
  { prefix: sessionsKeys.lists(), announcesEvery: true },
  // Presence is a heartbeat the stream does not carry.
  { prefix: hostsKeys.lists(), announcesEvery: false },
  { prefix: pullRequestsKeys.reviewSessions(), announcesEvery: false },
];

/**
 * Every event and the reads it refreshes: the one table both the stream's
 * refetches and the polls' stand-down are read from. A pairing detail is
 * never named: its `queryFn` mints a new token (`hostsKeys`). A session's
 * share and a shared view are not its row and are not announced, so they sit
 * beside `details()` and outside this table.
 */
const REFRESHES: RefreshTable = {
  // Every write that lands a start step raises it, so the stepper moves on it too.
  'session.changed': SESSION_CHANGED,
  'host.changed': [{ prefix: hostsKeys.lists(), announcesEvery: false }],
  // The token being spent.
  'pairing.spent': [
    { prefix: hostsKeys.pairingLists(), announcesEvery: true },
    { prefix: hostsKeys.lists(), announcesEvery: false },
  ],
  // A run's status follows its session, and `session.changed` does not name
  // automation reads, so their polls keep going.
  'automationRun.changed': [
    { prefix: automationsKeys.lists(), announcesEvery: false },
    { prefix: automationsKeys.runs(), announcesEvery: false },
    {
      prefix: automationsKeys.details(),
      key: (e) => automationsKeys.detail(e.automationId),
      announcesEvery: false,
    },
  ],
  // Every write raises `task.changed` or `milestone.changed`, an agent's
  // included. A task's change moves its milestone's progress, and moving a
  // milestone to another project moves its tasks with it.
  'task.changed': [
    { prefix: tasksKeys.lists(), announcesEvery: true },
    { prefix: tasksKeys.milestones(), announcesEvery: true },
  ],
  'milestone.changed': [
    { prefix: tasksKeys.milestones(), announcesEvery: true },
    { prefix: tasksKeys.lists(), announcesEvery: true },
  ],
  // Raising, deciding, expiring and running an approval each raise it: the
  // Inbox's list across bots, and the bot's own cards, which its chat also
  // hears on the bot's stream.
  'botApproval.changed': [
    {
      prefix: botsKeys.workspaceApprovals(),
      key: () => botsKeys.pendingApprovals(),
      announcesEvery: true,
    },
    // The bot's chat catches up on its own stream.
    {
      prefix: botsKeys.details(),
      key: (e) => botsKeys.approvals(e.botId),
      announcesEvery: false,
      catchUp: false,
    },
  ],
  // Every put and delete of the caller's marks.
  'inboxMark.changed': [{ prefix: inboxKeys.marks(), announcesEvery: true }],
};

/** The reads one event refreshes, at the keys they already have. */
function keysFor(event: WorkspaceEvent): readonly QueryKey[] {
  const refreshes = REFRESHES[event.type] as readonly Refresh<WorkspaceEvent>[];
  return refreshes.map((r) => r.key?.(event) ?? r.prefix);
}

function unique(keys: readonly QueryKey[]): readonly QueryKey[] {
  const seen = new Map(keys.map((key) => [JSON.stringify(key), key]));
  return [...seen.values()];
}

const ALL = Object.values(REFRESHES).flat() as readonly Refresh<WorkspaceEvent>[];
/** Each time the stream comes up, every read here refetches once, for what the gap may have missed. */
const CATCH_UP = unique(ALL.filter((r) => r.catchUp !== false).map((r) => r.prefix));
/** The reads every change to which is announced: their polls may stand down. */
const STANDS_DOWN = unique(ALL.filter((r) => r.announcesEvery).map((r) => r.prefix));

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
