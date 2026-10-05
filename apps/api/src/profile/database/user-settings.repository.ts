import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, TypeOrmRepositoryBase } from '@oppenheimer/backend-ddd';
import type { Repository } from 'typeorm';
import type { UserSettingsEntity } from '../domain/user-settings.entity';
import { ProfileMapper } from '../profile.mapper';
import { UserSettingsOrmEntity } from './user-settings.orm-entity';
import type { UserSettingsRepositoryPort } from './user-settings.repository.port';

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
