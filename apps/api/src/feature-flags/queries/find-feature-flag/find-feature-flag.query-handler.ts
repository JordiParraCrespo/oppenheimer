import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { isFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagRepositoryPort } from '../../database/feature-flag.repository.port';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FEATURE_FLAG_REPOSITORY } from '../../feature-flags.di-tokens';
import type { FeatureFlagView } from '../find-feature-flags/find-feature-flags.query';
import { FindFeatureFlagQuery } from './find-feature-flag.query';

@QueryHandler(FindFeatureFlagQuery)
export class FindFeatureFlagQueryHandler
  implements IQueryHandler<FindFeatureFlagQuery, FeatureFlagView>
{
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
  ) {}

  async execute(query: FindFeatureFlagQuery): Promise<FeatureFlagView> {
    if (!isFeatureFlagKey(query.key)) {
      throw new AppError(FeatureFlagErrors.UNKNOWN_FLAG, {
        detail: `No flag "${query.key}" is declared in the catalog.`,
        extensions: { flag: query.key },
      });
    }
    const found = await this.flags.findOneByKey(query.key);
    return { key: query.key, entity: found.isSome() ? found.unwrap() : undefined };
  }
}
