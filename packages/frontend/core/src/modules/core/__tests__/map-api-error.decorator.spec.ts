import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { MapApiError } from '../map-api-error.decorator';

const FETCH_FAILED = {
  code: 'USERS_CLIENT_002',
  message: 'Failed to fetch user',
};

const UPDATE_FAILED = {
  code: 'USERS_CLIENT_003',
  message: 'Failed to update user',
};

class Repository {
  readonly name = 'repository';

  @MapApiError(FETCH_FAILED)
  async findById(id: string): Promise<string> {
    if (id === 'offline') throw new Error('Network request failed');
    if (id === 'known') throw new AppError(UPDATE_FAILED);
    return `${this.name}:${id}`;
  }
}

describe('@MapApiError', () => {
  const repository = new Repository();

  it('returns the value when the call succeeds', async () => {
    await expect(repository.findById('42')).resolves.toBe('repository:42');
  });

  it('falls back to the declared error when the API said nothing useful', async () => {
    const error = await repository.findById('offline').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('USERS_CLIENT_002');
    expect((error as AppError).message).toBe('Failed to fetch user');
  });

  it('leaves an AppError thrown by the method itself untouched', async () => {
    const error = await repository.findById('known').catch((thrown: unknown) => thrown);

    expect((error as AppError).code).toBe('USERS_CLIENT_003');
  });

  it('rejects a non-method target', () => {
    expect(() =>
      MapApiError(FETCH_FAILED)(
        {},
        'notAMethod',
        {} as TypedPropertyDescriptor<() => Promise<void>>,
      ),
    ).toThrow(TypeError);
  });
});
