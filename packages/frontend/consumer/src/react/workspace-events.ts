'use client';

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { automationsKeys } from './automations.keys';
import { botsKeys } from './bots.keys';
import { useConsumerApp } from './context';
import { hostsKeys } from './hosts.keys';
import { inboxKeys } from './inbox.keys';
import { projectsKeys } from './projects.keys';
import { pullRequestsKeys } from './pull-requests.keys';
import { sessionsKeys } from './sessions.keys';
import { tasksKeys } from './tasks.keys';
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
    // A task made or moved to Done is a count on a project's Stats.
    { prefix: tasksKeys.stats(), announcesEvery: false },
  ],
  'milestone.changed': [
    { prefix: tasksKeys.milestones(), announcesEvery: true },
    { prefix: tasksKeys.lists(), announcesEvery: true },
  ],
  // A project made, changed or archived, a bot's included: the sidebar and
  // every picker read the one list. The Unassigned project is provisioned
  // without it, so the list keeps its own refetches.
  'project.changed': [{ prefix: projectsKeys.lists(), announcesEvery: false }],
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
  // Every notice a bot sends raises it: the Inbox's list across bots. The
  // bot's chat shows no notice, so it has nothing to refresh.
  'botNotice.changed': [{ prefix: botsKeys.workspaceNotices(), announcesEvery: true }],
  // Every put and delete of the caller's marks.
  'inboxMark.changed': [{ prefix: inboxKeys.marks(), announcesEvery: true }],
  // A report posted and a report answered each raise it: the Inbox's open reports.
  'inboxReport.changed': [{ prefix: inboxKeys.reports(), announcesEvery: true }],
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
 * The shortest gap between two refetches of one read that the stream asks for.
 *
 * Events come in bursts: a working agent reports each state it moves through
 * and each rewording of its status, and every one is a `session.changed` that
 * names the whole session list and the host list. Refetching on each would send
 * as many list reads as there are events, from every open tab, and the API's
 * per-route limit (`RATE_LIMIT_DEFAULT_LIMIT`, per browser session) answers the
 * excess with `RATE_001`, which the sidebar shows as "sending requests too
 * quickly". One read a second is as fresh as a person can see, and keeps a tab
 * under the limit whatever the agents do.
 */
export const STREAM_REFETCH_GAP_MS = 1000;

/**
 * Refetches a read at most once per {@link STREAM_REFETCH_GAP_MS}: the first
 * event after a quiet spell refetches at once, so a single change lands with no
 * delay; those within the gap after it collapse into one refetch at its end, so
 * the last change is never missed.
 */
function throttledInvalidate(queryClient: QueryClient) {
  const lastAt = new Map<string, number>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    invalidate(keys: readonly QueryKey[]): void {
      const now = Date.now();
      for (const queryKey of keys) {
        const id = JSON.stringify(queryKey);
        if (pending.has(id)) continue;
        const wait = (lastAt.get(id) ?? Number.NEGATIVE_INFINITY) + STREAM_REFETCH_GAP_MS - now;
        if (wait <= 0) {
          lastAt.set(id, now);
          invalidate(queryClient, [queryKey]);
          continue;
        }
        pending.set(
          id,
          setTimeout(() => {
            pending.delete(id);
            lastAt.set(id, Date.now());
            invalidate(queryClient, [queryKey]);
          }, wait),
        );
      }
    },
    dispose(): void {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    },
  };
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
 * changes, closes the stream. An event's refetches are paced per read
 * ({@link STREAM_REFETCH_GAP_MS}); the catch-up is not.
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
    const refetch = throttledInvalidate(queryClient);
    const offEvent = stream.onEvent((event) => refetch.invalidate(keysFor(event)));
    return () => {
      offStatus();
      offEvent();
      refetch.dispose();
      stream.dispose();
      setWorkspaceStream(queryClient, false, covers);
    };
  }, [app, queryClient, enabled, workspaceId]);
}
