import { QueryBase } from '@oppenheimer/backend-ddd';
import type { FlagEvaluationContext } from '@oppenheimer/shared/feature-flags';

export class GetClientFeatureFlagsQuery extends QueryBase {
  readonly context: FlagEvaluationContext;

  constructor(context: FlagEvaluationContext) {
    super();
    this.context = context;
  }
}
