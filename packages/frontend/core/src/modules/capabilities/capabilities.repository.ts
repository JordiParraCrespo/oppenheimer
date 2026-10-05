import { heyApiSdk } from '@oppenheimer/api-client';
import type { ClientDeployment } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { unwrapBody } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { CapabilitiesErrors } from './capabilities.errors';

/**
 * `GET /health/capabilities`. Public: capabilities gate what the login screen
 * offers, so the read must work before any session exists.
 */
@injectable()
export class CapabilitiesRepository {
  @MapApiError(CapabilitiesErrors.FETCH_FAILED)
  async get(): Promise<ClientDeployment> {
    return unwrapBody(heyApiSdk.deploymentCapabilities(), CapabilitiesErrors.FETCH_FAILED);
  }
}
