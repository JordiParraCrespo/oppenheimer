import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { TelegramAccountEntity } from '../domain/telegram-account.entity';
import { TelegramResource } from '../telegram.resource';
import { TelegramAccountMapper } from '../telegram-account.mapper';
import { TelegramAccountOrmEntity } from './telegram-account.orm-entity';
import type { TelegramAccountRepositoryPort } from './telegram-account.repository.port';

@Injectable()
export class TelegramAccountRepository
  extends ScopedRepositoryBase<TelegramAccountOrmEntity>
  implements TelegramAccountRepositoryPort
{
  protected readonly resource = TelegramResource;
  protected readonly alias = 'account';

  constructor(
    @InjectRepository(TelegramAccountOrmEntity)
    protected readonly repository: Repository<TelegramAccountOrmEntity>,
    private readonly mapper: TelegramAccountMapper,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<TelegramAccountEntity[]> {
    const records = await this.ownQuery(scope)
      .orderBy('account.createdAt', 'ASC')
      .addOrderBy('account.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<TelegramAccountEntity>> {
    const record = await this.ownQuery(scope).andWhere('account.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByHostForSystem(hostId: string): Promise<Option<TelegramAccountEntity>> {
    const record = await this.repository.findOneBy({ hostId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(account: TelegramAccountEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(account));
  }

  async save(account: TelegramAccountEntity): Promise<void> {
    const {
      id,
      organizationId,
      userId,
      hostId: _hostId,
      ...changes
    } = this.mapper.toPersistence(account);
    await this.repository.update({ id, organizationId, userId }, changes);
  }

  async delete(account: TelegramAccountEntity): Promise<void> {
    await this.repository.delete({
      id: account.id,
      organizationId: account.organizationId,
      userId: account.userId,
    });
  }

  /**
   * The workspace clause is the scope's; the owner is this repository's, so
   * even a caller who can read every row of the workspace reads only their own.
   */
  private ownQuery(scope: AccessScope) {
    return this.scopedQuery(scope).andWhere('account.userId = :userId', {
      userId: scope.userId,
    });
  }
}
