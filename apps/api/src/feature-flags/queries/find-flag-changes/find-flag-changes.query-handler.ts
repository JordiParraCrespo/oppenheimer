import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import type {
  FlagChangeRecord,
  FlagChangeRepositoryPort,
} from '../../database/flag-change.repository.port';
import { FLAG_CHANGE_REPOSITORY } from '../../feature-flags.di-tokens';
import { FindFlagChangesQuery } from './find-flag-changes.query';

@QueryHandler(FindFlagChangesQuery)
export class FindFlagChangesQueryHandler
  implements IQueryHandler<FindFlagChangesQuery, Paginated<FlagChangeRecord>>
{
  constructor(
    @Inject(FLAG_CHANGE_REPOSITORY)
    private readonly changes: FlagChangeRepositoryPort,
  ) {}

  execute(query: FindFlagChangesQuery): Promise<Paginated<FlagChangeRecord>> {
    return this.changes.find({
      subjectType: query.subjectType,
      subjectKey: query.subjectKey,
      page: query.page,
      limit: query.limit,
    });
  }
}
