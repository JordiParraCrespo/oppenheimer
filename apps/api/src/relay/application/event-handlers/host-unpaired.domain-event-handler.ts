import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RUNNER_LINK_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import type { LinkRegistryPort } from '../../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../../links/links.di-tokens';

/**
 * Closes the link of a host the moment it is unpaired.
 *
 * Unpairing is a row in the hosts module; the socket is here. Without this the
 * machine would keep its link until its next heartbeat found it unpaired — and
 * on an instance that does not hold the link, that heartbeat check is still what
 * closes it, because the registry this reads is per process.
 *
 * The code is terminal: the runner records that it was unpaired and stops
 * dialling, rather than walking its reconnect ladder forever.
 */
@Injectable()
export class HostUnpairedDomainEventHandler {
  private readonly logger = new Logger(HostUnpairedDomainEventHandler.name);

  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  @OnEvent(HostUnpairedDomainEvent.name)
  handle(event: Pick<HostUnpairedDomainEvent, 'aggregateId'>): void {
    const link = this.links.find(event.aggregateId);
    if (!link) return;
    link.close(RUNNER_LINK_CLOSE_CODES.UNPAIRED, 'host unpaired');
    this.logger.log({ message: 'closed the link of an unpaired host', hostId: event.aggregateId });
  }
}
