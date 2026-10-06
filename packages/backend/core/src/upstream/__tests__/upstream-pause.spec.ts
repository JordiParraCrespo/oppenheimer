import { describe, expect, it, vi } from 'vitest';
import { UpstreamPause, type UpstreamPauseStore } from '../upstream-pause';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');

function memoryStore(): UpstreamPauseStore & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get: async <T>(key: string) => values.get(key) as T | undefined,
    set: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
}

describe('UpstreamPause', () => {
  it('holds a bucket until the reset the provider gave, and only that bucket', async () => {
    const pause = new UpstreamPause('github');
    await pause.pause('installation:1', new Date(NOW + 30_000), NOW);

    expect(await pause.pausedUntil('installation:1', NOW + 29_000)).toEqual(new Date(NOW + 30_000));
    expect(await pause.pausedUntil('installation:2', NOW)).toBeNull();
    expect(await pause.pausedUntil('installation:1', NOW + 30_000)).toBeNull();
  });

  it('shares a pause through the store, so another replica stops too', async () => {
    const store = memoryStore();
    await new UpstreamPause('github', store).pause('app', new Date(NOW + 60_000), NOW);

    expect(await new UpstreamPause('github', store).pausedUntil('app', NOW)).toEqual(
      new Date(NOW + 60_000),
    );
  });

  it('pauses for the default when the provider gave no reset, and never past the cap', async () => {
    const pause = new UpstreamPause('google', undefined, {
      defaultPauseMs: 5_000,
      maxPauseMs: 60_000,
    });

    expect(await pause.pause('a', null, NOW)).toEqual(new Date(NOW + 5_000));
    expect(await pause.pause('b', new Date(NOW + 86_400_000), NOW)).toEqual(new Date(NOW + 60_000));
  });

  it('keeps working on what this process knows when the store is down', async () => {
    const broken: UpstreamPauseStore = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    const pause = new UpstreamPause('github', broken);
    await pause.pause('app', new Date(NOW + 10_000), NOW);

    expect(await pause.pausedUntil('app', NOW)).toEqual(new Date(NOW + 10_000));
  });
});
