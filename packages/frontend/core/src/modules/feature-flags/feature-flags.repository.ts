import { heyApiSdk } from '@oppenheimer/api-client';
import type { ClientFeatureFlags } from '@oppenheimer/shared/feature-flags';
import { injectable } from 'inversify';
import { unwrapBody } from '../core/errors';
import type { FeatureFlagsClientContext } from './feature-flags.client';
import { FeatureFlagsErrors } from './feature-flags.errors';

/**
 * Reads the caller's evaluated flags (`GET /v1/feature-flags`). Public: a
 * signed-out visitor gets flags too, so the login screen can be flagged.
 *
 * Through the generated operation, not a hand-built URL, so the query the API
 * takes (`platform`, `appVersion`) is checked against its own OpenAPI.
 */
@injectable()
export class FeatureFlagsRepository {
  async get(context: FeatureFlagsClientContext): Promise<ClientFeatureFlags> {
    return unwrapBody(
      heyApiSdk.getClientFeatureFlags({ query: context }),
      FeatureFlagsErrors.FETCH_FAILED,
    );
  }
}
