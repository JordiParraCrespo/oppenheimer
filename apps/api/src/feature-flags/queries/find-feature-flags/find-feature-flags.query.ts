import { QueryBase } from '@oppenheimer/backend-ddd';
import type { FeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagEntity } from '../../domain/feature-flag.entity';

/** A catalog flag and its saved targeting, if any. */
export interface FeatureFlagView {
  key: FeatureFlagKey;
  entity: FeatureFlagEntity | undefined;
}

/** Every flag in the catalog, joined to its targeting on this deployment. */
export class FindFeatureFlagsQuery extends QueryBase {}
