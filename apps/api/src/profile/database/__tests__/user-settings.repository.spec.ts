import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { UserSettingsEntity } from '../../domain/user-settings.entity';
import { ProfileMapper } from '../../profile.mapper';
import { UserSettingsOrmEntity } from '../user-settings.orm-entity';
import { UserSettingsRepository } from '../user-settings.repository';

/** The adapter over a stubbed ORM repository and an outbox that runs the write as given. */
function harness() {
  const orm = {
    target: UserSettingsOrmEntity,
    findOneBy: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    save: vi.fn(async (record: UserSettingsOrmEntity) => record),
  };
  const manager = { getRepository: vi.fn(() => orm) };
  const outbox = {
    writeWithEvents: vi.fn(async (_entities: unknown, write: (m: typeof manager) => unknown) =>
      write(manager),
    ),
  };
  const repository = new UserSettingsRepository(
    orm as unknown as Repository<UserSettingsOrmEntity>,
    new ProfileMapper(),
    outbox as unknown as OutboxService,
  );
  return { repository, orm, manager };
}

describe('UserSettingsRepository', () => {
  it('looks a row up by its userId key', async () => {
    const { repository, orm } = harness();

    const found = await repository.findOneById('user-1');

    expect(found.isNone()).toBe(true);
    expect(orm.findOneBy).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('deletes by its userId key', async () => {
    const { repository, orm } = harness();

    await expect(repository.delete(UserSettingsEntity.createDefault('user-1'))).resolves.toBe(true);
    expect(orm.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('saves through the ORM entity the adapter was built for', async () => {
    const { repository, orm, manager } = harness();

    const saved = await repository.save(UserSettingsEntity.createDefault('user-1'));

    expect(manager.getRepository).toHaveBeenCalledWith(UserSettingsOrmEntity);
    expect(orm.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(saved.userId).toBe('user-1');
  });
});
