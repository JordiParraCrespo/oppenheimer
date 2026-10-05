import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HostUnpairedDomainEvent } from '../../../hosts/domain/events/host-unpaired.domain-event';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';

/**
 * Removing a host pauses the automations that run on it (Settings: "automations
 * targeting it are paused"): they would otherwise fire, fail at dispatch, and
 * be paused one by one on their next trigger. Idempotent — an automation already
 * paused keeps its reason.
 */
@Injectable()
export class HostUnpairedPausesAutomationsDomainEventHandler {
  private readonly logger = new Logger(HostUnpairedPausesAutomationsDomainEventHandler.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  @OnEvent(HostUnpairedDomainEvent.name)
  async handle(event: Pick<HostUnpairedDomainEvent, 'aggregateId'>): Promise<void> {
    const now = new Date();
    const affected = await this.automations.findLiveOnHostForSystem(event.aggregateId);
    let paused = 0;
    for (const automation of affected) {
      if (automation.isPaused) continue;
      automation.pause('host_unpaired', now);
      await this.automations.saveForSystem(automation);
      paused += 1;
    }
    if (paused > 0) {
      this.logger.log({
        message: 'paused the automations of a removed host',
        hostId: event.aggregateId,
        paused,
      });
    }
  }
}
