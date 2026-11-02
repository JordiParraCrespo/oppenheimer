import { heyApiSdk } from '@oppenheimer/api-client';
import type { ClientDeployment } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { callApi } from '../core/errors';

import { CapabilitiesErrors } from './capabilities.errors';

/**
 * `GET /health/capabilities`. Public: capabilities gate what the login screen
 * offers, so the read must work before any session exists.
 */
@injectable()
export class CapabilitiesRepository {
  get(): Promise<ClientDeployment> {
    return callApi(CapabilitiesErrors.FETCH_FAILED, async (api) => {
      return api.body(heyApiSdk.deploymentCapabilities());
    });
  }
}
