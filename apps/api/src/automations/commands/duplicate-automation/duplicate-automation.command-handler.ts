import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationEntity } from '../../domain/automation.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { DuplicateAutomationCommand } from './duplicate-automation.command';

/**
 * Duplicate: "{name} copy", owned by whoever duplicated it, with the same
 * instructions, place and triggers — and a first revision of its own, because
 * the copy's history starts here.
 */
@CommandHandler(DuplicateAutomationCommand)
export class DuplicateAutomationCommandHandler
  implements ICommandHandler<DuplicateAutomationCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute(command: DuplicateAutomationCommand): Promise<AggregateID> {
    const { scope } = command;
    const original = requireFound(
      await this.automations.findOneById(scope, command.automationId),
      AutomationErrors.NOT_FOUND,
    );
    const { id: _id, number: _number, createdAt: _createdAt, ...revision } = original.revision;
    const copy = AutomationEntity.createNew({
      organizationId: original.organizationId,
      projectId: original.projectId,
      ownerUserId: scope.userId,
      name: `${original.name} copy`.slice(0, 200),
      revision: { ...revision, createdByUserId: scope.userId },
      triggers: original.triggers.map((trigger) => ({ ...trigger, id: randomUUID() })),
      active: !original.isPaused,
      overlap: original.overlap,
      maxRunsPerHour: original.maxRunsPerHour,
      now: new Date(),
    });
    await this.automations.insert(copy);
    return copy.id;
  }
}
