import type { ConfigService } from '@nestjs/config';
import type {
  DiskHealthIndicator,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '../../capabilities/capabilities.module';
import type { RedisHealthIndicator } from '../infrastructure/redis-health.adapter';
import { HealthProbeController } from '../probes/health.probe.controller';

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
    controller: new HealthProbeController(
      {} as HealthCheckService,
      {} as TypeOrmHealthIndicator,
      {} as MemoryHealthIndicator,
      {} as DiskHealthIndicator,
      {} as RedisHealthIndicator,
      capabilities,
      config,
    ),
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
