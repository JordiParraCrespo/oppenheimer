import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { PERSON_MEMORY_REPOSITORY } from '../../bots.di-tokens';
import type { PersonMemoryRepositoryPort } from '../../database/person-memory.repository.port';
import { UpdatePersonAboutCommand } from './update-person-about.command';

/**
 * Write what the caller says about themselves, for every bot they made in the
 * workspace. Only they write it: their bots read it in their prompt.
 */
@CommandHandler(UpdatePersonAboutCommand)
export class UpdatePersonAboutCommandHandler
  implements ICommandHandler<UpdatePersonAboutCommand, AggregateID>
{
  constructor(
    @Inject(PERSON_MEMORY_REPOSITORY) private readonly people: PersonMemoryRepositoryPort,
  ) {}

  async execute({ scope, about }: UpdatePersonAboutCommand): Promise<AggregateID> {
    const organizationId = scope.organizationId;
    requireOrganization(organizationId);
    await this.people.put(organizationId, scope.userId, about.trim());
    return scope.userId;
  }
}
