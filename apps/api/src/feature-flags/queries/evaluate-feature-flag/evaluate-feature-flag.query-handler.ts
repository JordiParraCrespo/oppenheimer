import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { type FlagEvaluation, isFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { FlagEvaluatorPort } from '../../application/flag-evaluator.port';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FLAG_EVALUATOR } from '../../feature-flags.di-tokens';
import { EvaluateFeatureFlagQuery } from './evaluate-feature-flag.query';

/**
 * Runs the same evaluator the product does, on the same snapshot — so the
 * answer is what a real request would get, including the reason and the rule
 * that decided.
 */
@QueryHandler(EvaluateFeatureFlagQuery)
export class EvaluateFeatureFlagQueryHandler
  implements IQueryHandler<EvaluateFeatureFlagQuery, FlagEvaluation>
{
  constructor(
    @Inject(FLAG_EVALUATOR)
    private readonly evaluator: FlagEvaluatorPort,
  ) {}

  async execute(query: EvaluateFeatureFlagQuery): Promise<FlagEvaluation> {
    if (!isFeatureFlagKey(query.key)) {
      throw new AppError(FeatureFlagErrors.UNKNOWN_FLAG, {
        detail: `No flag "${query.key}" is declared in the catalog.`,
        extensions: { flag: query.key },
      });
    }
    return this.evaluator.evaluate(query.key, query.context);
  }
}
