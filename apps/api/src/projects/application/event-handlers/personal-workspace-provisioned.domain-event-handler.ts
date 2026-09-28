import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PersonalWorkspaceProvisionedDomainEvent } from '../../../organizations/domain/events/personal-workspace-provisioned.domain-event';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';

/**
 * Gives a new workspace its Unassigned project, where a session that names no
 * project is listed (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * The workspace is the organizations module's row; the project is here. The
 * write is idempotent, so the outbox redelivering the event writes nothing the
 * second time. A workspace made on `/onboarding` is an organization created
 * from the console, and gets its project from
 * `OrganizationCreatedDomainEventHandler` instead.
 */
@Injectable()
export class PersonalWorkspaceProvisionedDomainEventHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  @OnEvent(PersonalWorkspaceProvisionedDomainEvent.name)
  async handle(event: Pick<PersonalWorkspaceProvisionedDomainEvent, 'aggregateId'>): Promise<void> {
    await this.projects.provisionUnassigned(event.aggregateId);
  }
}
