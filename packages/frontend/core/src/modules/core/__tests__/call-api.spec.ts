import { describe, expect, it } from 'vitest';
import { AppError, callApi } from '../errors';

// What a repository method reports when its call fails: the regressions are a
// failure that loses the server's explanation or status, or one that comes
// back as a bare `Error` the console cannot word.
const FETCH_FAILED = { code: 'USERS_CLIENT_002', message: 'Failed to fetch user' };
const UPDATE_FAILED = { code: 'USERS_CLIENT_003', message: 'Failed to update user' };

const response = (status: number) => ({ status }) as Response;
const failure = (promise: Promise<unknown>) => promise.catch((thrown: unknown) => thrown);

describe('callApi', () => {
  it('returns what the call returns', async () => {
    await expect(
      callApi(FETCH_FAILED, async (api) => (await api.body({ data: { id: '42' } })).id),
    ).resolves.toBe('42');
  });

  it("keeps the problem document and status the API sent, on the call's fallback", async () => {
    const problem = { type: 'about:blank', title: 'Host offline', status: 409, code: 'HOST_009' };
    const error = await failure(
      callApi(FETCH_FAILED, (api) => api.body({ error: problem, response: response(409) })),
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('HOST_009');
    expect((error as AppError).status).toBe(409);
  });

  it('fails an absent body as a failed read, not an empty result', async () => {
    const error = await failure(
      callApi(FETCH_FAILED, (api) => api.body({ data: undefined, response: response(200) })),
    );
    expect((error as AppError).code).toBe('USERS_CLIENT_002');
    expect((error as AppError).status).toBe(200);
  });

  it('lets a result be empty', async () => {
    await expect(callApi(FETCH_FAILED, (api) => api.result({ data: undefined }))).resolves.toBe(
      undefined,
    );
  });

  it('turns anything else the call throws into the declared failure', async () => {
    const error = await failure(
      callApi(FETCH_FAILED, async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('USERS_CLIENT_002');
    expect((error as AppError).message).toBe('Failed to fetch user');
  });

  it('leaves an AppError the call raised itself untouched', async () => {
    const error = await failure(
      callApi(FETCH_FAILED, async () => {
        throw new AppError(UPDATE_FAILED);
      }),
    );
    expect((error as AppError).code).toBe('USERS_CLIENT_003');
  });
});
