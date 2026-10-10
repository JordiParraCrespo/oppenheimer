/**
 * What the probes answer over HTTP: liveness consults nothing, readiness maps
 * an unavailable dependency to 503 with the same body, and capabilities serve
 * `hosts` from the resolution the boot log prints. How readiness decides is
 * `readiness.indicator.spec.ts`.
 */
import { ConfigService } from '@nestjs/config';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import { resolveCapabilities } from '../../capabilities/capabilities.module';
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

/**
 * `GET /health/capabilities` serves `hosts` from the resolution the boot log
 * prints, so the console and the log never disagree on whether this server
 * can pair, and server-internal capabilities stay off the public probe.
 */
const RUNNER_RELEASES = {
  'hosts.installUrl': 'https://releases.example.com/install.sh',
  'hosts.releaseBaseUrl': 'https://releases.example.com',
  'hosts.signingKeyFingerprint': 'f'.repeat(64),
};

function controllerWith(values: Record<string, unknown>) {
  const config = { get: (key: string) => values[key] } as ConfigService;
  const capabilities = new CapabilitiesService(resolveCapabilities(config));
  return {
    controller: new HealthProbeController({} as ReadinessIndicator, capabilities, config),
    capabilities,
  };
}

describe('GET /health/capabilities', () => {
  it('reports hosts on when the runner release settings are configured', () => {
    const { controller, capabilities } = controllerWith(RUNNER_RELEASES);

    expect(controller.deploymentCapabilities().hosts).toBe(true);
    expect(capabilities.describe()).toContain('hosts=on');
  });

  it('reports hosts off, as the boot log does, when they are not', () => {
    const { controller, capabilities } = controllerWith({
      ...RUNNER_RELEASES,
      'hosts.installUrl': undefined,
    });

    expect(controller.deploymentCapabilities().hosts).toBe(false);
    expect(capabilities.describe()).toContain('hosts=off');
  });

  it('still keeps server-internal capabilities off the wire', () => {
    const { controller } = controllerWith({
      ...RUNNER_RELEASES,
      'storage.provider': 's3',
      'storage.s3AccessKeyId': 'key',
      'storage.s3SecretAccessKey': 'secret',
    });

    const wire = controller.deploymentCapabilities();
    expect(wire).not.toHaveProperty('s3_storage');
    expect(wire).not.toHaveProperty('email_delivery');
  });
});
