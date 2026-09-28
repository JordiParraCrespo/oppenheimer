import { describe, expect, it } from 'vitest';
import { createAuthStore } from '../../modules/auth/auth.state';
import { AppError } from '../../modules/core/errors';
import { createQueryClient, shouldRetryQuery } from '../query-client';
import { authKeys } from '../query-keys';
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
  const client = createQueryClient(app, 0);
  // What the previous account had on screen, and the record of the session.
  client.setQueryData(usersKeys.list(), ['someone else']);
  client.setQueryData(authKeys.session(), 'user-1');
  return { store, client };
}

const refuse = (status: number) => () => Promise.reject(new AppError(FAILED, { status }));

describe('createQueryClient', () => {
  it('a query answered 401 signs the user out and forgets their cached data', async () => {
    const { store, client } = setup(true);

    await client.fetchQuery({ queryKey: usersKeys.me(), queryFn: refuse(401) }).catch(() => {});

    expect(store.getState().isAuthenticated).toBe(false);
    expect(client.getQueryData(usersKeys.list())).toBeUndefined();
    expect(client.getQueryData(authKeys.session())).toBe('user-1');
  });

  it('a mutation answered 401 does the same', async () => {
    const { store, client } = setup(true);

    await client
      .getMutationCache()
      .build(client, { mutationFn: refuse(401) })
      .execute(undefined)
      .catch(() => {});

    expect(store.getState().isAuthenticated).toBe(false);
    expect(client.getQueryData(usersKeys.list())).toBeUndefined();
  });

  it('reads the status off any failure that carries one, not only an AppError', async () => {
    const { store, client } = setup(true);

    await client
      .fetchQuery({
        queryKey: usersKeys.me(),
        queryFn: () => Promise.reject(Object.assign(new Error('auth'), { status: 401 })),
      })
      .catch(() => {});

    expect(store.getState().isAuthenticated).toBe(false);
  });

  it('leaves a signed-out store and its cache alone: a 401 there is a wrong password', async () => {
    const { client } = setup(false);

    await client.fetchQuery({ queryKey: usersKeys.me(), queryFn: refuse(401) }).catch(() => {});

    expect(client.getQueryData(usersKeys.list())).toEqual(['someone else']);
  });

  it('leaves the store alone for any other failure', async () => {
    const { store, client } = setup(true);

    await client.fetchQuery({ queryKey: usersKeys.me(), queryFn: refuse(403) }).catch(() => {});

    expect(store.getState().isAuthenticated).toBe(true);
  });
});

describe('shouldRetryQuery', () => {
  it('does not retry a refusal the server explained', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(shouldRetryQuery(0, new AppError(FAILED, { status }))).toBe(false);
    }
    expect(shouldRetryQuery(0, Object.assign(new Error('x'), { status: 404 }))).toBe(false);
  });

  it('retries a server error or a request that got no answer, once', () => {
    expect(shouldRetryQuery(0, new AppError(FAILED, { status: 503 }))).toBe(true);
    expect(shouldRetryQuery(0, new AppError(FAILED))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new AppError(FAILED))).toBe(false);
  });
});
