import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FEATURE_FLAG_KEYS } from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagRepositoryPort } from '../../database/feature-flag.repository.port';
import { FEATURE_FLAG_REPOSITORY } from '../../feature-flags.di-tokens';
import { type FeatureFlagView, FindFeatureFlagsQuery } from './find-feature-flags.query';

/**
 * Lists the catalog, not the table: a flag nobody has configured is still a
 * flag an operator may want to turn on, and a row whose key left the catalog
 * is not one the code reads any more.
 */
@QueryHandler(FindFeatureFlagsQuery)
export class FindFeatureFlagsQueryHandler
  implements IQueryHandler<FindFeatureFlagsQuery, FeatureFlagView[]>
{
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
  ) {}

  async execute(): Promise<FeatureFlagView[]> {
    const configured = new Map((await this.flags.findAll()).map((flag) => [flag.key, flag]));
    return FEATURE_FLAG_KEYS.map((key) => ({ key, entity: configured.get(key) }));
  }
}
