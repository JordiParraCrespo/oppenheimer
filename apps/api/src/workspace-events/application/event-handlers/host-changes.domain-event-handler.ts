import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HostRegisteredDomainEvent } from '../../../hosts/domain/events/host-registered.domain-event';
import { HostRenamedDomainEvent } from '../../../hosts/domain/events/host-renamed.domain-event';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * The one announcer of a host its owner can see changing: paired, renamed or
 * unpaired. A host belongs to its owner, not to a workspace, so the change
 * goes to the owner's streams. A registration is also a pairing token spent,
 * which is what Add host waits on: the token names the flow, the host the
 * machine it paired.
 *
 * Presence is not announced. It is derived from `lastSeenAt` on every read and
 * never written as a transition, so the console's presence poll stays the
 * way it learns a host came or went.
 */
@Injectable()
export class HostChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(HostRegisteredDomainEvent.name)
  async onRegistered(
    event: Pick<HostRegisteredDomainEvent, 'aggregateId' | 'ownerUserId' | 'pairingTokenId'>,
  ): Promise<void> {
    await this.bus.publish(
      { userId: event.ownerUserId },
      { type: 'pairing.spent', id: event.pairingTokenId, hostId: event.aggregateId },
    );
    await this.changed(event);
  }

  @OnEvent(HostRenamedDomainEvent.name)
  async onRenamed(event: Pick<HostRenamedDomainEvent, 'aggregateId' | 'ownerUserId'>) {
    // A rename staged before the event carried its owner reaches no console.
    if (event.ownerUserId) await this.changed(event);
  }

  @OnEvent(HostUnpairedDomainEvent.name)
  async onUnpaired(event: Pick<HostUnpairedDomainEvent, 'aggregateId' | 'ownerUserId'>) {
    await this.changed(event);
  }

  private async changed(event: { aggregateId: string; ownerUserId: string }): Promise<void> {
    await this.bus.publish(
      { userId: event.ownerUserId },
      { type: 'host.changed', id: event.aggregateId },
    );
  }
}
