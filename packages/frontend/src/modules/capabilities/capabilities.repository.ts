import { HealthApi } from '@oppenheimer/api-client';
import type { ClientCapabilities } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { AppError } from '../core/errors';
import { MapApiError } from '../core/map-api-error.decorator';
import { CapabilitiesErrors } from './capabilities.errors';

/**
 * Reads the deployment's client-facing capabilities
 * (`GET /health/capabilities`) — the subset a client shows or hides UI for.
 * Public — capabilities gate what the login screen offers, so the read must
 * work before any session exists.
 */
@injectable()
export class CapabilitiesRepository {
  @MapApiError(CapabilitiesErrors.FETCH_FAILED)
  async get(): Promise<ClientCapabilities> {
    const data = await HealthApi.deploymentCapabilities();
    if (!data) throw new AppError(CapabilitiesErrors.FETCH_FAILED);
    return data;
  }
}
