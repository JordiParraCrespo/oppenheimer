import { AppError } from '@oppenheimer/backend-core';
import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';
import {
  asArray,
  asRecord,
  type BetterAuthFailure,
  betterAuthInvoker,
  unwrap,
  unwrapArray,
} from '../infrastructure/better-auth.util';

describe('asRecord', () => {
  it('returns the object itself when given a plain object', () => {
    const obj = { a: 1 };
    expect(asRecord(obj)).toBe(obj);
  });

  it('returns an empty object for non-objects and null', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord('string')).toEqual({});
    expect(asRecord(42)).toEqual({});
  });

  it('treats an array as an object (typeof array === object)', () => {
    const arr = [1, 2];
    expect(asRecord(arr)).toBe(arr);
  });
});

describe('asArray', () => {
  it('returns arrays untouched', () => {
    const arr = [1, 2, 3];
    expect(asArray(arr)).toBe(arr);
  });

  it('returns an empty array for non-arrays', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray({})).toEqual([]);
    expect(asArray('nope')).toEqual([]);
  });
});

describe('unwrap', () => {
  it('unwraps a single-key envelope', () => {
    expect(unwrap({ member: { id: '1' } }, 'member')).toEqual({ id: '1' });
  });

  it('returns the value itself when the key is absent', () => {
    const value = { id: '1' };
    expect(unwrap(value, 'member')).toBe(value);
  });

  it('returns the envelope value even when it is null/undefined', () => {
    expect(unwrap({ member: null }, 'member')).toBeNull();
  });
});

describe('unwrapArray', () => {
  it('unwraps an array envelope', () => {
    expect(unwrapArray({ members: [{ id: '1' }] }, 'members')).toEqual([{ id: '1' }]);
  });

  it('coerces to an array when the key is absent', () => {
    expect(unwrapArray([{ id: '1' }], 'members')).toEqual([{ id: '1' }]);
    expect(unwrapArray('nope', 'members')).toEqual([]);
  });

  it('returns an empty array when the enveloped value is not an array', () => {
    expect(unwrapArray({ members: 'nope' }, 'members')).toEqual([]);
  });
});

describe('betterAuthInvoker', () => {
  const CATALOG = {
    NOT_FOUND: { code: 'ORG_001', message: 'Organization not found', httpStatus: 404 },
    SLUG_TAKEN: {
      code: 'ORG_002',
      message: 'That organization slug is already taken',
      httpStatus: 409,
    },
    UPSTREAM_FAILED: {
      code: 'ORG_016',
      message: 'The organization service failed to handle this request',
      httpStatus: 502,
    },
  } as const;

  const mapper = ({ upstreamCode, status }: BetterAuthFailure) => {
    if (upstreamCode === 'ORGANIZATION_SLUG_ALREADY_TAKEN') return CATALOG.SLUG_TAKEN;
    if (status >= 500) return CATALOG.UPSTREAM_FAILED;
    return CATALOG.NOT_FOUND;
  };

  const invoke = betterAuthInvoker(mapper);

  it('returns the value from a successful call', async () => {
    await expect(invoke(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('turns an APIError into a catalog AppError, keeping the upstream code and message', async () => {
    const apiError = new APIError('CONFLICT', {
      message: 'Organization slug already taken',
      code: 'ORGANIZATION_SLUG_ALREADY_TAKEN',
    });

    const err = await invoke(() => Promise.reject(apiError)).catch((e: AppError) => e);

    expect(err).toBeInstanceOf(AppError);
    // The catalog entry decides the client-facing contract...
    expect(err.code).toBe('ORG_002');
    expect(err.title).toBe('That organization slug is already taken');
    expect(err.getStatus()).toBe(409);
    // ...and nothing Better Auth said is lost.
    expect(err.detail).toBe('Organization slug already taken');
    expect(err.extensions).toEqual({ upstreamCode: 'ORGANIZATION_SLUG_ALREADY_TAKEN' });
  });

  it('passes the status to the mapper when the APIError carries no code', async () => {
    const err = await invoke(() => Promise.reject(new APIError('BAD_REQUEST', {}))).catch(
      (e: AppError) => e,
    );

    expect(err.code).toBe('ORG_001');
    expect(err.extensions).toEqual({});
  });

  it('maps a non-APIError onto the catalog as an upstream failure', async () => {
    const cause = new Error('socket hang up');
    const err = await invoke(() => Promise.reject(cause)).catch((e: AppError) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('ORG_016');
    expect(err.getStatus()).toBe(502);
    // The underlying message is for the log only — never the response.
    expect(err.detail).toBeUndefined();
    expect(err.cause).toBe(cause);
  });

  it('maps a thrown non-Error value the same way', async () => {
    const err = await invoke(() => Promise.reject('string failure')).catch((e: AppError) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('ORG_016');
  });
});
