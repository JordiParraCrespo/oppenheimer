import { QueryBase } from '@oppenheimer/backend-ddd';
import type { FlagEvaluationContext } from '@oppenheimer/shared/feature-flags';

/**
 * "What would this flag say for this person?" — evaluated against a context the
 * operator describes, so a rule can be checked before and after saving without
 * signing in as the customer.
 */
export class EvaluateFeatureFlagQuery extends QueryBase {
  readonly key: string;
  readonly context: FlagEvaluationContext;

  constructor(key: string, context: FlagEvaluationContext) {
    super();
    this.key = key;
    this.context = context;
  }
}
