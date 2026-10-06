import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { WorkspaceEventsPort } from '../../../workspace-events/application/workspace-events.port';
import { WORKSPACE_EVENTS } from '../../../workspace-events/workspace-events.di-tokens';
import { HostRegisteredDomainEvent } from '../../domain/events/host-registered.domain-event';
import { HostUnpairedDomainEvent } from '../../domain/events/host-unpaired.domain-event';

/**
 * Tells the owner's console a host joined or left their list. A registration
 * is also the pairing token being spent, which is what Add host waits on: the
 * token's id names the flow, and the host's id is the machine it paired.
 * A host belongs to its owner, not to a workspace, so both go to the owner.
 */
@Injectable()
export class HostPairedOrUnpairedDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENTS)
    private readonly events: WorkspaceEventsPort,
  ) {}

  @OnEvent(HostRegisteredDomainEvent.name)
  onRegistered(
    event: Pick<HostRegisteredDomainEvent, 'aggregateId' | 'ownerUserId' | 'pairingTokenId'>,
  ): void {
    const owner = { userId: event.ownerUserId };
    this.events.publish(owner, {
      type: 'pairing.spent',
      id: event.pairingTokenId,
      hostId: event.aggregateId,
    });
    this.events.publish(owner, { type: 'host.changed', id: event.aggregateId });
  }

  @OnEvent(HostUnpairedDomainEvent.name)
  onUnpaired(event: Pick<HostUnpairedDomainEvent, 'aggregateId' | 'ownerUserId'>): void {
    this.events.publish(
      { userId: event.ownerUserId },
      { type: 'host.changed', id: event.aggregateId },
    );
  }
}
