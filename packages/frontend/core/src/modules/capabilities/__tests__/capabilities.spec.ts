import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../core/errors';
import { CapabilitiesErrors } from '../capabilities.errors';

/**
 * What the deployment can actually do, read before any session exists so the
 * login screen can hide a social button for a provider with no credentials.
 *
 * The failure semantics are the point: an error here means the API was
 * unreachable, which says nothing about what is configured. Returning an empty
 * capability set on failure would hide every provider on a deployment that has
 * them all — a login page with no way in.
 */

const api = vi.hoisted(() => ({ deploymentCapabilities: vi.fn() }));

vi.mock('@oppenheimer/api-client', () => ({ HealthApi: api }));

const { CapabilitiesRepository } = await import('../capabilities.repository');
const { CapabilitiesService } = await import('../capabilities.service');

describe('CapabilitiesRepository', () => {
  let repository: InstanceType<typeof CapabilitiesRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CapabilitiesRepository();
  });

  it('returns the capability set the deployment reports', async () => {
    api.deploymentCapabilities.mockResolvedValue({
      google_oauth: true,
      github_oauth: false,
    });

    await expect(repository.get()).resolves.toEqual({
      google_oauth: true,
      github_oauth: false,
    });
  });

  it('passes an empty set through as a real answer', async () => {
    // A deployment with no optional features configured genuinely reports
    // nothing, and that is different from the failure below.
    api.deploymentCapabilities.mockResolvedValue({});

    await expect(repository.get()).resolves.toEqual({});
  });

  it('fails rather than reporting an unreachable API as "nothing configured"', async () => {
    // The distinction this whole file exists for. Swallowing this into `{}`
    // renders a login page with every provider hidden.
    api.deploymentCapabilities.mockResolvedValue(undefined);

    const error = await repository.get().catch((thrown: AppError) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(CapabilitiesErrors.FETCH_FAILED.code);
  });
});

describe('CapabilitiesService', () => {
  it('reads through the repository', async () => {
    const get = vi.fn().mockResolvedValue({ google_oauth: true });
    const service = new CapabilitiesService({ get } as never);

    await expect(service.get()).resolves.toEqual({ google_oauth: true });
    expect(get).toHaveBeenCalled();
  });

  it('lets a failed read propagate rather than substituting a default', async () => {
    const get = vi.fn().mockRejectedValue(new AppError(CapabilitiesErrors.FETCH_FAILED));
    const service = new CapabilitiesService({ get } as never);

    await expect(service.get()).rejects.toBeInstanceOf(AppError);
  });
});
