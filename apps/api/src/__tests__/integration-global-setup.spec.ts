import { describe, expect, it, vi } from 'vitest';
import { provisionIntegrationServices, type StartedServers } from './integration-global-setup';
import { parseDatabasesReply } from './integration-servers';

/**
 * The integration run's global setup, without Docker: what it leaves running
 * when migrating the template fails. The claim of a Redis db against a real
 * server is `integration-servers.integration.spec.ts`.
 */
describe('provisionIntegrationServices', () => {
  const servers = (): StartedServers => ({
    postgres: { host: 'pg', port: 5432, username: 'test', password: 'test' },
    redis: { host: 'redis', port: 6379 },
    release: vi.fn(async () => {}),
  });

  it('releases the servers it started when migrating fails, and rethrows', async () => {
    // Its teardown is never returned then, and `ci:local` runs without Ryuk:
    // a broken migration once left a Postgres and a Redis behind per retry.
    const started = servers();
    const broken = new Error('migration 1700000000000 failed');

    await expect(
      provisionIntegrationServices({
        start: async () => started,
        migrate: async () => {
          throw broken;
        },
      }),
    ).rejects.toBe(broken);

    expect(started.release).toHaveBeenCalledTimes(1);
  });

  it('leaves the servers running for the suite when migrating succeeds', async () => {
    const started = servers();
    const migrate = vi.fn(async () => {});

    const { services, teardown } = await provisionIntegrationServices({
      start: async () => started,
      migrate,
    });

    expect(migrate).toHaveBeenCalledWith(services);
    expect(services.template.startsWith(`${services.runId}_`)).toBe(true);
    expect(started.release).not.toHaveBeenCalled();
    await teardown();
    expect(started.release).toHaveBeenCalledWith(services.runId);
  });
});

describe('parseDatabasesReply', () => {
  it('reads the count from CONFIG GET databases', () => {
    expect(parseDatabasesReply(['databases', '16'])).toBe(16);
  });

  it('refuses a reply that is not one, rather than claiming from a guess', () => {
    expect(() => parseDatabasesReply([])).toThrow(/CONFIG GET databases/);
    expect(() => parseDatabasesReply(['databases', 'many'])).toThrow(/CONFIG GET databases/);
  });
});
