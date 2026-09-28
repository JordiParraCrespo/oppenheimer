import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AutomationRepositoryInputDto, TriggerInputDto } from '@oppenheimer/shared';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../hosts/hosts.di-tokens';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../projects/projects.di-tokens';
import type { AutomationRepository, AutomationTriggerProps } from '../domain/automation.types';
import { automationAgentSupported } from '../domain/automation-agent.policy';
import { AutomationErrors } from '../domain/automations.errors';
import { neverFires, triggerFromInput } from '../domain/trigger-config.policy';

/**
 * Confirms what an editor save names, through the ports of the modules that
 * own it, and turns the editor's words into what is stored. Every check is the
 * caller's: a project they can see and that holds work, repositories their
 * workspace's installations reach, a host they may use, an agent that can run
 * unattended, triggers that will fire.
 */
@Injectable()
export class AutomationPlanFactory {
  constructor(
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
  ) {}

  async assertProject(scope: AccessScope, projectId: string): Promise<void> {
    const found = await this.projects.findOneById(scope, projectId);
    if (found.isNone()) throw new AppError(AutomationErrors.PROJECT_UNAVAILABLE);
    const project = found.unwrap();
    if (project.isArchived || project.isUnassigned) {
      throw new AppError(AutomationErrors.PROJECT_UNAVAILABLE, {
        detail: project.isArchived ? 'The project is archived' : 'Unassigned holds no automations',
      });
    }
  }

  async resolveRepositories(
    scope: AccessScope,
    inputs: readonly AutomationRepositoryInputDto[],
  ): Promise<AutomationRepository[]> {
    const resolved: AutomationRepository[] = [];
    for (const input of inputs) {
      const repository = await this.repositories.repositoryOf(
        scope,
        input.installationId,
        input.githubRepoId,
      );
      resolved.push({
        installationId: input.installationId,
        githubRepoId: String(input.githubRepoId),
        fullName: repository.fullName,
      });
    }
    return resolved;
  }

  async assertHost(scope: AccessScope, hostId: string): Promise<void> {
    await this.hosts.assertUsable(scope, hostId);
  }

  assertAgent(agent: string): void {
    if (!automationAgentSupported(agent)) {
      throw new AppError(AutomationErrors.AGENT_UNSUPPORTED, {
        detail: `${agent} has no unattended mode`,
      });
    }
  }

  triggers(inputs: readonly TriggerInputDto[], now: Date): AutomationTriggerProps[] {
    const triggers = inputs.map((input, position) => triggerFromInput(input, position));
    if (triggers.some((trigger) => neverFires(trigger, now))) {
      throw new AppError(AutomationErrors.TRIGGER_NEVER_FIRES, {
        detail: 'A schedule trigger has no time left to fire at',
      });
    }
    return triggers;
  }
}
