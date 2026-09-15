import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSettingsRepositoryPort } from '../../../database/user-settings.repository.port';
import { UserSettingsEntity } from '../../../domain/user-settings.entity';
import { UpdateUserSettingsCommand } from '../update-user-settings.command';
import { UpdateUserSettingsService } from '../update-user-settings.service';

const COMMAND = new UpdateUserSettingsCommand({
  userId: 'user-uuid',
  theme: 'dark',
  locale: 'en',
  density: 'compact',
  weeklyDigest: false,
  productUpdates: true,
});

describe('UpdateUserSettingsService', () => {
  let service: UpdateUserSettingsService;
  let repo: Pick<UserSettingsRepositoryPort, 'findOneById' | 'save'>;

  beforeEach(() => {
    repo = {
      findOneById: vi.fn().mockResolvedValue(None),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    service = new UpdateUserSettingsService(repo as UserSettingsRepositoryPort);
  });

  it('creates the record on a first save', async () => {
    // No row is provisioned at sign-up, so the first save has nothing to load.
    const id = await service.execute(COMMAND);

    expect(id).toBe('user-uuid');
    const saved = vi.mocked(repo.save).mock.calls[0][0] as UserSettingsEntity;
    expect(saved.userId).toBe('user-uuid');
    expect(saved.theme).toBe('dark');
    expect(saved.locale).toBe('en');
    expect(saved.density).toBe('compact');
    expect(saved.weeklyDigest).toBe(false);
    expect(saved.productUpdates).toBe(true);
  });

  it('updates the existing record rather than making a second one', async () => {
    const existing = UserSettingsEntity.createDefault('user-uuid');
    repo.findOneById = vi.fn().mockResolvedValue(Some(existing));

    await service.execute(COMMAND);

    expect(repo.save).toHaveBeenCalledWith(existing);
    expect(existing.theme).toBe('dark');
  });

  it('replaces every preference, including the ones left at their default', async () => {
    const existing = UserSettingsEntity.create({
      id: 'user-uuid',
      props: {
        theme: 'light',
        locale: 'es',
        density: 'compact',
        weeklyDigest: true,
        productUpdates: true,
      },
    });
    repo.findOneById = vi.fn().mockResolvedValue(Some(existing));

    await service.execute(
      new UpdateUserSettingsCommand({
        userId: 'user-uuid',
        theme: 'system',
        locale: 'es',
        density: 'comfortable',
        weeklyDigest: false,
        productUpdates: false,
      }),
    );

    expect(existing.density).toBe('comfortable');
    expect(existing.weeklyDigest).toBe(false);
    expect(existing.productUpdates).toBe(false);
  });
});
