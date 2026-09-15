import { DEFAULT_USER_SETTINGS } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSettingsRepositoryPort } from '../../../database/user-settings.repository.port';
import { UserSettingsEntity } from '../../../domain/user-settings.entity';
import { GetUserSettingsQuery } from '../get-user-settings.query';
import { GetUserSettingsQueryHandler } from '../get-user-settings.query-handler';

describe('GetUserSettingsQueryHandler', () => {
  let repo: Pick<UserSettingsRepositoryPort, 'findOneById'>;
  let handler: GetUserSettingsQueryHandler;

  beforeEach(() => {
    repo = { findOneById: vi.fn().mockResolvedValue(None) };
    handler = new GetUserSettingsQueryHandler(repo as UserSettingsRepositoryPort);
  });

  it('answers with the defaults when nothing is saved', async () => {
    // A 404 here would push the same "not found means defaults" branch, and a
    // copy of the default values, into every client.
    const settings = await handler.execute(new GetUserSettingsQuery('user-uuid'));

    expect(settings.userId).toBe('user-uuid');
    expect(settings.theme).toBe(DEFAULT_USER_SETTINGS.theme);
    expect(settings.locale).toBe(DEFAULT_USER_SETTINGS.locale);
    expect(settings.density).toBe(DEFAULT_USER_SETTINGS.density);
  });

  it('does not persist the defaults it hands out', async () => {
    const readOnly = repo as UserSettingsRepositoryPort & { save?: unknown };

    await handler.execute(new GetUserSettingsQuery('user-uuid'));

    expect(readOnly.save).toBeUndefined();
  });

  it('returns the saved record when there is one', async () => {
    const saved = UserSettingsEntity.create({
      id: 'user-uuid',
      props: {
        theme: 'dark',
        locale: 'en',
        density: 'compact',
        weeklyDigest: false,
        productUpdates: true,
      },
    });
    repo.findOneById = vi.fn().mockResolvedValue(Some(saved));

    await expect(handler.execute(new GetUserSettingsQuery('user-uuid'))).resolves.toBe(saved);
  });
});
