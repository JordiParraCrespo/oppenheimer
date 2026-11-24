import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CliError, ExitCode } from '../lib/errors';
import { createProgram } from '../program';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

const restarted = (hints: string[]) =>
  new Response(JSON.stringify({ id: SESSION_ID, name: 'Fix login', hints }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const run = (...args: string[]) =>
  createProgram().parseAsync([
    'node',
    'opp',
    '--api-url',
    'https://api.example.com',
    '--token',
    'oppenheimer_pat_test',
    ...args,
  ]);

/**
 * `opp sessions restart` brings a stopped session back. What breaks this: a
 * restart its host never got (offline, and a restart is never sent again)
 * exiting 0, so a script carries on as if the session were coming back.
 */
describe('opp sessions restart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks the API to restart the session and exits 0 when its host has it', async () => {
    const fetch = vi.fn().mockResolvedValue(restarted([]));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await run('sessions', 'restart', SESSION_ID);

    expect(String(fetch.mock.calls[0][0])).toContain(`/sessions/${SESSION_ID}/restart`);
  });

  it('fails with exit 1 when the host is offline, the restart never delivered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(restarted(['host_offline'])));
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const error = (await run('--json', 'sessions', 'restart', SESSION_ID).catch(
      (e) => e,
    )) as CliError;

    expect(error.exitCode).toBe(ExitCode.FAILURE);
    expect(error.message).toContain('the restart did not reach it');
  });
});
