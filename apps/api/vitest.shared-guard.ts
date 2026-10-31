import { afterAll, beforeAll, vi } from 'vitest';

/**
 * The shared project runs every file of a worker in one module graph
 * (`isolate: false`), so what a file leaves behind is the next file's world.
 * This fails the file that leaves fake timers on, `process.env` changed or a
 * well-known global replaced, instead of letting a later, unrelated file go
 * red. Restore it in `afterEach`/`afterAll`; a file that must replace a module
 * or a global through `vi.mock`/`vi.stubGlobal` runs isolated by itself
 * (`vitest.config.ts`).
 */
const GLOBALS = ['fetch', 'WebSocket', 'setTimeout', 'setInterval', 'Date', 'crypto'] as const;

let env: Record<string, string | undefined>;
let globals: unknown[];

beforeAll(() => {
  env = { ...process.env };
  globals = GLOBALS.map((name) => globalThis[name]);
});

afterAll(() => {
  // `unstubEnvs`/`unstubGlobals` undo a stub before the next test, so the last
  // test's stubs are still in place here.
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const leaks: string[] = [];
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
    leaks.push('fake timers are still installed');
  }
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)]);
  for (const key of keys) {
    if (process.env[key] === env[key]) continue;
    leaks.push(`process.env.${key} changed`);
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  GLOBALS.forEach((name, i) => {
    if (globalThis[name] !== globals[i]) leaks.push(`globalThis.${name} was replaced`);
  });
  if (leaks.length > 0)
    throw new Error(`This file leaks into the next one in its worker: ${leaks.join('; ')}.`);
});
