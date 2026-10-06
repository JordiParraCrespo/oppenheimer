import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';

/**
 * Who a change is for. A session or a run belongs to a workspace; a host and
 * its pairing tokens belong to the person who paired it, which every workspace
 * they are in borrows (`hosts.resource.ts`), so a host's change goes to that
 * person's streams.
 */
export type WorkspaceEventAudience = { organizationId: string } | { userId: string };

/**
 * What a module calls once a change has **committed**: the console's streams
 * then refetch what it names (`product/versions/mvp/21-workspace-events.md`).
 *
 * Fire and forget. An event is an invalidation, never the data, so one that is
 * lost costs a screen the time until its poll or its next refetch, never a
 * wrong answer; `publish` never throws and never makes its caller wait.
 */
export interface WorkspaceEventsPort {
  publish(audience: WorkspaceEventAudience, event: WorkspaceEvent): void;
}

/**
 * What the stream endpoint subscribes through, on every replica: an event
 * published on one reaches the streams held by all of them.
 */
export interface WorkspaceEventFeedPort {
  /**
   * Resolves once the subscription is in place, so an event published after
   * that is delivered. The returned function ends it.
   */
  subscribe(
    audiences: readonly WorkspaceEventAudience[],
    listener: (event: WorkspaceEvent) => void,
  ): Promise<() => void>;
}
