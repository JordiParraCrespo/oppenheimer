/**
 * What the probes answer over HTTP: liveness consults nothing, readiness maps
 * an unavailable dependency to 503 with the same body. How readiness decides
 * is `readiness.indicator.spec.ts`.
 */
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { HealthProbeController } from '../probes/health.probe.controller';
import type { ReadinessIndicator } from '../probes/readiness.indicator';

function controller(status: 'ok' | 'error') {
  const readiness = {
    check: vi.fn(async () => ({
      status,
      checks: { database: { status }, redis: { status: 'ok' } },
    })),
  };
  return {
    readiness,
    probes: new HealthProbeController(
      readiness as unknown as ReadinessIndicator,
      {} as never,
      new ConfigService({}),
    ),
  };
}

describe('the probes', () => {
  it('answers liveness without checking any dependency', () => {
    const { probes, readiness } = controller('error');

    expect(probes.check()).toEqual({ status: 'ok' });
    expect(readiness.check).not.toHaveBeenCalled();
  });

  it('serves 503 when a dependency is unavailable, and leaves 200 alone otherwise', async () => {
    const down = controller('error');
    const res = { status: vi.fn() };
    await expect(down.probes.readiness(res as never)).resolves.toMatchObject({ status: 'error' });
    expect(res.status).toHaveBeenCalledWith(503);

    const ok = controller('ok');
    const okRes = { status: vi.fn() };
    await ok.probes.readiness(okRes as never);
    expect(okRes.status).not.toHaveBeenCalled();
  });
});
