import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { createAuthStore } from '../../modules/auth/auth.state';
import { AppError } from '../../modules/core/errors';
import { createQueryClientConfig, shouldRetryQuery } from '../session-expiry';
import { usersKeys } from '../users.queries';

const FAILED = { code: 'X_CLIENT_001', message: 'Failed' };

function setup(isAuthenticated: boolean) {
  const store = createAuthStore();
  store.setState({ isAuthenticated });
  const app = {
    auth: {
      expireSession: () => {
        if (!store.getState().isAuthenticated) return false;
        store.setState({ isAuthenticated: false });
        return true;
      },
    },
  };
  const client = new QueryClient(createQueryClientConfig(app, 0));
  return { store, client };
}

describe('createQueryClientConfig', () => {
  it('a query answered 401 signs the user out of the auth store', async () => {
    const { store, client } = setup(true);

    await client
      .fetchQuery({
        queryKey: usersKeys.me(),
        queryFn: () => Promise.reject(new AppError(FAILED, { status: 401 })),
      })
      .catch(() => {});

    expect(store.getState().isAuthenticated).toBe(false);
  });

  it('a mutation answered 401 signs the user out too', async () => {
    const { store, client } = setup(true);

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(new AppError(FAILED, { status: 401 })),
      })
      .execute(undefined)
      .catch(() => {});

    expect(store.getState().isAuthenticated).toBe(false);
  });

  it('leaves the store alone for any other failure', async () => {
    const { store, client } = setup(true);

    await client
      .fetchQuery({
        queryKey: usersKeys.me(),
        queryFn: () => Promise.reject(new AppError(FAILED, { status: 403 })),
      })
      .catch(() => {});

    expect(store.getState().isAuthenticated).toBe(true);
  });
});

describe('shouldRetryQuery', () => {
  it('does not retry a refusal the server explained', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(shouldRetryQuery(0, new AppError(FAILED, { status }))).toBe(false);
    }
  });

  it('retries a server error or a request that got no answer, once', () => {
    expect(shouldRetryQuery(0, new AppError(FAILED, { status: 503 }))).toBe(true);
    expect(shouldRetryQuery(0, new AppError(FAILED))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new AppError(FAILED))).toBe(false);
  });
});
