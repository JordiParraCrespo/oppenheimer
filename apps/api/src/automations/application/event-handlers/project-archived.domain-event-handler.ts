import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectArchivedDomainEvent } from '../../../projects/domain/events/project-archived.domain-event';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';

/**
 * Retiring a project pauses the automations set up for it: nothing new is
 * listed under it, so they would otherwise fire, fail at dispatch and be
 * paused one by one on their next trigger. Idempotent — an automation already
 * paused keeps its reason.
 */
@Injectable()
export class ProjectArchivedPausesAutomationsDomainEventHandler {
  private readonly logger = new Logger(ProjectArchivedPausesAutomationsDomainEventHandler.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  @OnEvent(ProjectArchivedDomainEvent.name)
  async handle(event: Pick<ProjectArchivedDomainEvent, 'aggregateId'>): Promise<void> {
    const now = new Date();
    const affected = await this.automations.findLiveInProjectForSystem(event.aggregateId);
    let paused = 0;
    for (const automation of affected) {
      if (automation.isPaused) continue;
      automation.pause('project_archived', now);
      await this.automations.saveForSystem(automation);
      paused += 1;
    }
    if (paused > 0) {
      this.logger.log({
        message: 'paused the automations of a retired project',
        projectId: event.aggregateId,
        paused,
      });
    }
  }
}
