import { CLIENT_FEATURE_FLAG_KEYS } from '@oppenheimer/shared/feature-flags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlagSnapshotResolver } from '../application/flag-snapshot.resolver';
import type { FeatureFlagRepositoryPort } from '../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../database/flag-segment.repository.port';
import { FeatureFlagEntity } from '../domain/feature-flag.entity';

function killSwitchPulled(): FeatureFlagEntity {
  const flag = FeatureFlagEntity.createFor('api_token_creation', true);
  flag.setEnabled(false, { actorId: 'admin' });
  return flag;
}

describe('FlagSnapshotResolver', () => {
  let flags: Pick<FeatureFlagRepositoryPort, 'findAll' | 'fingerprint'>;
  let segments: Pick<FlagSegmentRepositoryPort, 'findAll' | 'fingerprint'>;
  let resolver: FlagSnapshotResolver;

  beforeEach(() => {
    flags = {
      findAll: vi.fn().mockResolvedValue([]),
      fingerprint: vi.fn().mockResolvedValue('0:0'),
    };
    segments = {
      findAll: vi.fn().mockResolvedValue([]),
      fingerprint: vi.fn().mockResolvedValue('0:0'),
    };
    resolver = new FlagSnapshotResolver(
      flags as FeatureFlagRepositoryPort,
      segments as FlagSegmentRepositoryPort,
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('serves every catalog default before anything has loaded', () => {
    expect(resolver.isEnabled('api_token_creation', {})).toBe(true);
    expect(resolver.evaluate('api_token_creation', {}).reason).toBe('DEFAULT');
  });

  it('serves what the database says once loaded', async () => {
    vi.mocked(flags.findAll).mockResolvedValue([killSwitchPulled()]);
    await resolver.refresh();

    expect(resolver.isEnabled('api_token_creation', { userId: 'u1' })).toBe(false);
    expect(resolver.evaluate('api_token_creation', {}).reason).toBe('DISABLED');
  });

  it('keeps the last good snapshot when a reload fails', async () => {
    vi.mocked(flags.findAll).mockResolvedValue([killSwitchPulled()]);
    await resolver.refresh();

    vi.mocked(flags.findAll).mockRejectedValue(new Error('database down'));
    await expect(resolver.refresh()).resolves.toBeUndefined();

    // A kill switch must stay pulled through a database blip.
    expect(resolver.isEnabled('api_token_creation', {})).toBe(false);
  });

  it('rejects a reload that fails, so the change handler is retried', async () => {
    vi.mocked(flags.findAll).mockRejectedValue(new Error('database down'));
    await expect(resolver.reload()).rejects.toThrow('database down');
  });

  it('is enabled only while a boolean flag serves true', async () => {
    vi.mocked(flags.findAll).mockResolvedValue([killSwitchPulled()]);
    await resolver.refresh();
    expect(resolver.isEnabled('api_token_creation', {})).toBe(false);
  });

  it('ignores a row whose key has left the catalog', async () => {
    vi.mocked(flags.findAll).mockResolvedValue([FeatureFlagEntity.createFor('retired_flag', true)]);
    await resolver.refresh();

    expect(resolver.evaluateClientFlags({}).flags).not.toHaveProperty('retired_flag');
  });

  it('serves every client flag, and a version that moves with the data', async () => {
    const before = resolver.evaluateClientFlags({});
    expect(Object.keys(before.flags)).toEqual(CLIENT_FEATURE_FLAG_KEYS);

    vi.mocked(flags.fingerprint).mockResolvedValue('1:1700000000000');
    vi.mocked(flags.findAll).mockResolvedValue([killSwitchPulled()]);
    await resolver.refresh();

    const after = resolver.evaluateClientFlags({});
    expect(after.version).not.toBe(before.version);
    expect(after.flags.api_token_creation).toBe(false);
  });

  it('reports every outage, even when nothing changed during the last one', async () => {
    const warn = vi.spyOn((resolver as unknown as { logger: { warn: () => void } }).logger, 'warn');
    const poll = () => (resolver as unknown as { reloadIfStale(): Promise<void> }).reloadIfStale();
    await resolver.refresh();

    vi.mocked(flags.fingerprint).mockRejectedValueOnce(new Error('down'));
    await poll();
    await poll(); // back up, same data
    vi.mocked(flags.fingerprint).mockRejectedValueOnce(new Error('down again'));
    await poll();

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent refreshes into one load', async () => {
    await Promise.all([resolver.refresh(), resolver.refresh(), resolver.refresh()]);
    expect(flags.findAll).toHaveBeenCalledTimes(1);
  });
});
