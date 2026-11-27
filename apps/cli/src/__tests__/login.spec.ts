import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CliError, ExitCode } from '../lib/errors';
import { createProgram } from '../program';

/**
 * `opp login` signs in and trades the session for a token at once. The API
 * mints none for an account whose email is not verified (`TOKEN_010`), and
 * the CLI says so with the way out instead of a "missing permission" hint.
 */
describe('opp login', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'opp-login-'));
    vi.stubEnv('OPPENHEIMER_CONFIG', join(dir, 'config.json'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });

  it('explains that an unverified account must verify its email, and stores nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.endsWith('/api/auth/sign-in/email')) {
          return json(200, {}, { 'set-auth-token': 'session-1' });
        }
        if (url.endsWith('/tokens/permissions')) return json(200, { grantable: ['tokens:read'] });
        if (url.endsWith('/api/auth/get-session')) return json(200, null);
        if (url.endsWith('/tokens')) {
          return json(403, {
            status: 403,
            code: 'TOKEN_010',
            title: 'Verify your email address before issuing a credential',
          });
        }
        return json(404, {});
      }),
    );

    const error = (await createProgram()
      .parseAsync(
        [
          '--api-url',
          'https://api.example.com',
          'login',
          '--email',
          'someone@example.com',
          '--password',
          'pw',
        ],
        { from: 'user' },
      )
      .catch((caught: unknown) => caught)) as CliError;

    expect(error.code).toBe('TOKEN_010');
    expect(error.exitCode).toBe(ExitCode.FORBIDDEN);
    expect(error.message).toMatch(/verified its email/);
    expect(error.hint).toMatch(/verification email/);
    expect(existsSync(join(dir, 'config.json'))).toBe(false);
  });
});
