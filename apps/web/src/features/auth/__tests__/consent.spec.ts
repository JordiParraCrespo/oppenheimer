import { AppError } from '@oppenheimer/frontend-core';
import type { PermissionGroup, Scope } from '@oppenheimer/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consentSearchSchema, describeScopes, submitConsent } from '../lib/consent';

/**
 * The consent screen is where a person decides what an OAuth client may do on
 * their behalf. These pin the two things it must get right: every requested
 * scope is shown (recognised or not), and the answer's failures reach the
 * screen as coded `AppError`s with the status that tells "the server said no"
 * from "the server was never reached".
 */

function group(resource: string, sensitive = false): PermissionGroup {
  const level = (access: 'read' | 'write') => ({
    scope: `${resource}:${access}` as Scope,
    label: access,
    description: access,
    policies: [],
  });
  return {
    resource,
    label: resource,
    description: resource,
    sensitive,
    levels: { read: level('read'), write: level('write') },
  } as PermissionGroup;
}

const PROFILE = group('profile');
const USERS = group('users', true);
const GROUPS = [PROFILE, USERS];

describe('describeScopes', () => {
  it('matches each requested scope to its group and level, splitting on spaces and commas', () => {
    const { scopes, unknown } = describeScopes('profile:read, users:write  profile:write', GROUPS);

    expect(scopes).toEqual([
      { group: PROFILE, level: 'read' },
      { group: PROFILE, level: 'write' },
      { group: USERS, level: 'write' },
    ]);
    expect(unknown).toEqual([]);
  });

  it('surfaces a scope the catalog does not describe instead of dropping it', () => {
    const { scopes, unknown } = describeScopes('profile:read admin:everything', GROUPS);

    expect(scopes).toEqual([{ group: PROFILE, level: 'read' }]);
    expect(unknown).toEqual(['admin:everything']);
  });

  it('counts a repeated scope once', () => {
    const { scopes, unknown } = describeScopes('profile:read profile:read', GROUPS);

    expect(scopes).toHaveLength(1);
    expect(unknown).toEqual([]);
  });

  it('reads a missing or blank scope as asking for nothing', () => {
    expect(describeScopes(undefined, GROUPS)).toEqual({ scopes: [], unknown: [] });
    expect(describeScopes(' , ', GROUPS)).toEqual({ scopes: [], unknown: [] });
  });
});

describe('consentSearchSchema', () => {
  it('keeps the snake_case params and reads empty or malformed ones as absent', () => {
    expect(
      consentSearchSchema.parse({ consent_code: 'c1', client_id: '', scope: 42, extra: 'x' }),
    ).toEqual({ consent_code: 'c1', client_id: undefined, scope: undefined });
  });
});

describe('submitConsent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answer(status: number, body: unknown) {
    const fetchMock = vi.fn(
      async () =>
        new Response(body === undefined ? 'not json' : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('posts the answer with the consent code and returns the redirect', async () => {
    const fetchMock = answer(200, { redirectURI: 'https://client.example/cb?code=x' });

    await expect(submitConsent(true, 'code-1')).resolves.toBe('https://client.example/cb?code=x');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/oauth2/consent');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({
      accept: true,
      consent_code: 'code-1',
    });
  });

  it('sends a refusal as accept: false', async () => {
    const fetchMock = answer(200, { redirectURI: 'https://client.example/cb?error=access_denied' });

    await submitConsent(false, 'code-1');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).accept).toBe(false);
  });

  it('rejects an answer with no redirect as its own code, keeping the status', async () => {
    answer(200, {});

    const error = await submitConsent(true, 'code-1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'CONSENT_CLIENT_002', status: 200 });
  });

  it("carries the server's code and status when it refuses", async () => {
    answer(400, { code: 'INVALID_CONSENT_CODE', message: 'Invalid code' });

    const error = await submitConsent(true, 'code-1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INVALID_CONSENT_CODE', status: 400 });
  });

  it('falls back to its own code for a refusal that names none', async () => {
    answer(500, undefined);

    const error = await submitConsent(true, 'code-1').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'CONSENT_CLIENT_001', status: 500 });
  });

  it('keeps no status when the request never reached the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const error = await submitConsent(true, 'code-1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'CONSENT_CLIENT_001' });
    expect((error as AppError).status).toBeUndefined();
  });
});
