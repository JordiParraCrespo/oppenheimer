import { vi } from 'vitest';

/**
 * What a spec in the shared project (`isolate: false`) must leave as it found
 * it, because the next file in its worker runs in the same process:
 * `process.env`, the real timers and the well-known globals below.
 * `vitest.shared-guard.ts` snapshots it before a file and restores it after.
 */
const GLOBALS = ['fetch', 'WebSocket', 'setTimeout', 'setInterval', 'Date', 'crypto'] as const;

type GlobalName = (typeof GLOBALS)[number];

export interface SharedWorld {
  env: Record<string, string | undefined>;
  globals: Map<GlobalName, unknown>;
}

export function snapshotWorld(): SharedWorld {
  return {
    env: { ...process.env },
    globals: new Map(GLOBALS.map((name) => [name, globalThis[name]])),
  };
}

/**
 * Puts back everything a file changed, so the next file sees the world as it
 * was, and answers what had leaked.
 */
export function restoreWorld(world: SharedWorld): string[] {
  // `unstubEnvs`/`unstubGlobals` undo a stub before the next test, so the
  // last test's stubs are still in place here; they are not leaks.
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const leaks: string[] = [];
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
    leaks.push('fake timers are still installed');
  }
  const keys = new Set([...Object.keys(world.env), ...Object.keys(process.env)]);
  for (const key of keys) {
    if (process.env[key] === world.env[key]) continue;
    leaks.push(`process.env.${key} changed`);
    const original = world.env[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  for (const [name, original] of world.globals) {
    if (globalThis[name] === original) continue;
    leaks.push(`globalThis.${name} was replaced`);
    Object.defineProperty(globalThis, name, {
      value: original,
      writable: true,
      configurable: true,
    });
  }
  return leaks;
}

/** The error a leaking file fails with: what leaked, and how to stop it. */
export function leakError(leaks: string[]): Error {
  return new Error(
    `This file leaks into the next one in its worker: ${leaks.join('; ')}. ` +
      'Restore it in afterEach (vi.useRealTimers(), or vi.stubEnv/vi.stubGlobal, ' +
      'which the config undoes, instead of assigning by hand). A file that needs ' +
      'a module mock calls vi.mock in the spec itself, which moves it to the ' +
      'isolated project (vitest.config.ts).',
  );
}
