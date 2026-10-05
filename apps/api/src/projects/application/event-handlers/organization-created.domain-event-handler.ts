import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrganizationCreatedDomainEvent } from '../../../organizations/domain/events/organization-created.domain-event';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';

/**
 * Gives an organization made from the console its Unassigned project, as
 * {@link PersonalWorkspaceProvisionedDomainEventHandler} does for the one
 * sign-up provisions: every workspace has one, whichever door it came in by.
 * The write is idempotent.
 */
@Injectable()
export class OrganizationCreatedDomainEventHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  @OnEvent(OrganizationCreatedDomainEvent.name)
  async handle(event: Pick<OrganizationCreatedDomainEvent, 'aggregateId'>): Promise<void> {
    await this.projects.provisionUnassigned(event.aggregateId);
  }
}
