import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ClientFeatureFlags } from '@oppenheimer/shared/feature-flags';
import type { FlagEvaluatorPort } from '../../application/flag-evaluator.port';
import { FLAG_EVALUATOR } from '../../feature-flags.di-tokens';
import { GetClientFeatureFlagsQuery } from './get-client-feature-flags.query';

/**
 * Evaluated values only — never the rules. Sending targeting to a client would
 * publish unreleased feature names, customer ID lists and rollout percentages
 * to anyone who opens the network tab.
 */
@QueryHandler(GetClientFeatureFlagsQuery)
export class GetClientFeatureFlagsQueryHandler
  implements IQueryHandler<GetClientFeatureFlagsQuery, ClientFeatureFlags>
{
  constructor(
    @Inject(FLAG_EVALUATOR)
    private readonly evaluator: FlagEvaluatorPort,
  ) {}

  async execute(query: GetClientFeatureFlagsQuery): Promise<ClientFeatureFlags> {
    return this.evaluator.evaluateClientFlags(query.context);
  }
}
