/**
 * The shared unit project's guard (`vitest.shared-guard.ts`): after a file
 * that changed the process, the next file in the worker sees the process as it
 * was before, and the file that changed it is told what leaked. Each case
 * plays one file's leak and then reads the world as the next file would.
 */
import { describe, expect, it, vi } from 'vitest';
import { leakError, restoreWorld, snapshotWorld } from './shared-world';

describe('restoreWorld', () => {
  it('gives the next file back a global the last one replaced by hand', () => {
    const original = globalThis.fetch;
    const world = snapshotWorld();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const leaks = restoreWorld(world);

    expect(leaks).toEqual(['globalThis.fetch was replaced']);
    expect(globalThis.fetch).toBe(original);
  });

  it('gives back the real setTimeout and turns fake timers off', () => {
    const original = globalThis.setTimeout;
    const world = snapshotWorld();
    vi.useFakeTimers();

    const leaks = restoreWorld(world);

    expect(leaks).toContain('fake timers are still installed');
    expect(vi.isFakeTimers()).toBe(false);
    expect(globalThis.setTimeout).toBe(original);
  });

  it('puts back an environment variable that was set, changed or removed', () => {
    process.env.SHARED_WORLD_KEPT = 'before';
    process.env.SHARED_WORLD_REMOVED = 'before';
    const world = snapshotWorld();
    process.env.SHARED_WORLD_KEPT = 'after';
    delete process.env.SHARED_WORLD_REMOVED;
    process.env.SHARED_WORLD_ADDED = 'after';

    const leaks = restoreWorld(world);

    expect(leaks.sort()).toEqual([
      'process.env.SHARED_WORLD_ADDED changed',
      'process.env.SHARED_WORLD_KEPT changed',
      'process.env.SHARED_WORLD_REMOVED changed',
    ]);
    expect(process.env.SHARED_WORLD_KEPT).toBe('before');
    expect(process.env.SHARED_WORLD_REMOVED).toBe('before');
    expect('SHARED_WORLD_ADDED' in process.env).toBe(false);
    delete process.env.SHARED_WORLD_KEPT;
    delete process.env.SHARED_WORLD_REMOVED;
  });

  it('does not count what vi.stubEnv and vi.stubGlobal did, and undoes it', () => {
    const original = globalThis.fetch;
    const world = snapshotWorld();
    vi.stubEnv('SHARED_WORLD_STUBBED', 'yes');
    vi.stubGlobal('fetch', vi.fn());

    expect(restoreWorld(world)).toEqual([]);
    expect(globalThis.fetch).toBe(original);
    expect('SHARED_WORLD_STUBBED' in process.env).toBe(false);
  });

  it('reports nothing for a file that changed nothing', () => {
    expect(restoreWorld(snapshotWorld())).toEqual([]);
  });
});

describe('leakError', () => {
  it('names the leak and both ways out of it', () => {
    const { message } = leakError(['globalThis.fetch was replaced']);
    expect(message).toContain('globalThis.fetch was replaced');
    expect(message).toContain('afterEach');
    expect(message).toContain('isolated project');
  });
});
