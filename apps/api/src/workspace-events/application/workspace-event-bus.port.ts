import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';

/**
 * Who a change is for. A session or a run belongs to a workspace; a host and
 * its pairing tokens belong to the person who paired it, which every workspace
 * they are in borrows (`hosts.resource.ts`), so a host's change goes to that
 * person's streams.
 */
export type WorkspaceEventAudience = { organizationId: string } | { userId: string };

/**
 * The channel between the replica that saw a change commit and the replicas
 * holding the console streams it concerns.
 *
 * Only this module's domain-event handlers publish, and they run from the
 * outbox: `publish` rejects when the change did not reach the channel, and the
 * outbox delivers the event again. A change is therefore announced at least
 * once, after its commit, whatever process wrote it.
 */
export interface WorkspaceEventBusPort {
  publish(audience: WorkspaceEventAudience, event: WorkspaceEvent): Promise<void>;

  /**
   * Resolves once the subscription is in place, so an event published after
   * that is delivered. The returned function ends it.
   *
   * `onLost` is called, once, if the subscription is dropped under the
   * listener (the replica's connection to the bus closed): nothing published
   * from then on reaches it, so its stream has to end and be dialled again.
   */
  subscribe(
    audiences: readonly WorkspaceEventAudience[],
    listener: (event: WorkspaceEvent) => void,
    onLost: () => void,
  ): Promise<() => void>;
}
