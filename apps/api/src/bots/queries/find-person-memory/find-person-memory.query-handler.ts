import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { BOT_MEMORY_FACT_REPOSITORY, PERSON_MEMORY_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import type { PersonMemoryRepositoryPort } from '../../database/person-memory.repository.port';
import { FindPersonMemoryQuery, type PersonMemory } from './find-person-memory.query';

/**
 * Settings → Memory: what the caller wrote about themselves, and every fact
 * about them that a bot of theirs keeps.
 */
@QueryHandler(FindPersonMemoryQuery)
export class FindPersonMemoryQueryHandler
  implements IQueryHandler<FindPersonMemoryQuery, PersonMemory>
{
  constructor(
    @Inject(PERSON_MEMORY_REPOSITORY) private readonly people: PersonMemoryRepositoryPort,
    @Inject(BOT_MEMORY_FACT_REPOSITORY) private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute({ scope }: FindPersonMemoryQuery): Promise<PersonMemory> {
    const organizationId = scope.organizationId;
    requireOrganization(organizationId);
    const [about, facts] = await Promise.all([
      this.people.find(organizationId, scope.userId),
      this.memory.findAboutPerson(scope),
    ]);
    return { about, facts };
  }
}
