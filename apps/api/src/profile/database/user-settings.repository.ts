import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Repository } from 'typeorm';
import type { UserSettingsEntity } from '../domain/user-settings.entity';
import { ProfileMapper } from '../profile.mapper';
import { UserSettingsOrmEntity } from './user-settings.orm-entity';
import type { UserSettingsRepositoryPort } from './user-settings.repository.port';

/**
 * TypeORM-backed adapter for a user's preferences. Translates between the
 * domain `UserSettingsEntity` and its persistence model via `ProfileMapper`,
 * and stages any domain events the aggregate collected on the transactional
 * outbox, atomically with the write that raised them.
 *
 * The row is keyed by `userId`, which is also the aggregate's id, so `save` is
 * an upsert: it creates the row on a first save and updates it thereafter.
 * That is what lets the read side hand out unsaved defaults without the write
 * side caring.
 */
@Injectable()
export class UserSettingsRepository
  extends TypeOrmRepositoryBase<UserSettingsEntity, UserSettingsOrmEntity>
  implements UserSettingsRepositoryPort
{
  protected override readonly idColumn = 'userId';

  constructor(
    @InjectRepository(UserSettingsOrmEntity)
    protected readonly repository: Repository<UserSettingsOrmEntity>,
    protected readonly mapper: ProfileMapper,
    protected readonly outbox: OutboxService,
  ) {
    super();
  }
}
