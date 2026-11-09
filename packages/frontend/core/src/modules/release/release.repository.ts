import { heyApiSdk } from '@oppenheimer/api-client';
import type { ApiVersion } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { callApi } from '../core/errors';

import { ReleaseErrors } from './release.errors';

/** `GET /health/version`: the release the API runs. Needs a signed-in session. */
@injectable()
export class ReleaseRepository {
  getApiVersion(): Promise<ApiVersion> {
    return callApi(ReleaseErrors.FETCH_FAILED, async (api) => {
      return api.body(heyApiSdk.findApiVersion());
    });
  }
}
