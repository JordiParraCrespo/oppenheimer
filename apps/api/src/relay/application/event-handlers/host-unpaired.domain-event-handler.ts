import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RUNNER_LINK_CLOSE_CODES, RUNNER_LINK_CLOSE_REASONS } from '@oppenheimer/shared/protocol';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import type { LinkRegistryPort } from '../../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../../links/links.di-tokens';

/**
 * Closes the link of a host the moment it is unpaired, rather than at its next
 * heartbeat. The registry is per process, so on an instance not holding the link
 * that heartbeat check is still what closes it. The close code is terminal: the
 * runner records that it was unpaired and stops dialling instead of walking its
 * reconnect ladder forever. A removal that asked for the machine to be cleaned up
 * says so in the close's reason, which the runner acts on and an older one ignores.
 */
@Injectable()
export class HostUnpairedDomainEventHandler {
  private readonly logger = new Logger(HostUnpairedDomainEventHandler.name);

  constructor(
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
  ) {}

  @OnEvent(HostUnpairedDomainEvent.name)
  handle(event: Pick<HostUnpairedDomainEvent, 'aggregateId'> & { wipe?: boolean }): void {
    const link = this.links.find(event.aggregateId);
    if (!link) return;
    link.close(
      RUNNER_LINK_CLOSE_CODES.UNPAIRED,
      event.wipe ? RUNNER_LINK_CLOSE_REASONS.WIPE : 'host unpaired',
    );
    this.logger.log({
      message: 'closed the link of an unpaired host',
      hostId: event.aggregateId,
      wipe: event.wipe ?? false,
    });
  }
}
