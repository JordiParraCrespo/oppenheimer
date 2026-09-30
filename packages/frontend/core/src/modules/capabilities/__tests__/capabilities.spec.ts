import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../core/errors';
import { CapabilitiesErrors } from '../capabilities.errors';

// The failure rule: see `useDeploymentCapabilities` in react/capabilities.queries.ts.

const api = vi.hoisted(() => ({ deploymentCapabilities: vi.fn() }));

vi.mock('@oppenheimer/api-client', () => ({ heyApiSdk: api }));

/** A generated SDK call's result: the body, and no error. */
function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

const { CapabilitiesRepository } = await import('../capabilities.repository');

describe('CapabilitiesRepository', () => {
  let repository: InstanceType<typeof CapabilitiesRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CapabilitiesRepository();
  });

  it('returns the capability set the deployment reports', async () => {
    api.deploymentCapabilities.mockResolvedValue(
      ok({
        google_oauth: true,
        github_oauth: false,
      }),
    );

    await expect(repository.get()).resolves.toEqual({
      google_oauth: true,
      github_oauth: false,
    });
  });

  it('passes an empty set through as a real answer', async () => {
    api.deploymentCapabilities.mockResolvedValue(ok({}));

    await expect(repository.get()).resolves.toEqual({});
  });

  it('fails rather than reporting an unreachable API as "nothing configured"', async () => {
    // The distinction this whole file exists for. Swallowing this into `{}`
    // renders a login page with every provider hidden.
    api.deploymentCapabilities.mockResolvedValue(ok(undefined));

    const error = await repository.get().catch((thrown: AppError) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(CapabilitiesErrors.FETCH_FAILED.code);
  });
});
