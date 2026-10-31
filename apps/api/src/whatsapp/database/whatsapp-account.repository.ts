import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import { WhatsappResource } from '../whatsapp.resource';
import { WhatsappAccountMapper } from '../whatsapp-account.mapper';
import { WhatsappAccountOrmEntity } from './whatsapp-account.orm-entity';
import type { WhatsappAccountRepositoryPort } from './whatsapp-account.repository.port';

@Injectable()
export class WhatsappAccountRepository
  extends ScopedRepositoryBase<WhatsappAccountOrmEntity>
  implements WhatsappAccountRepositoryPort
{
  protected readonly resource = WhatsappResource;
  protected readonly alias = 'account';

  constructor(
    @InjectRepository(WhatsappAccountOrmEntity)
    protected readonly repository: Repository<WhatsappAccountOrmEntity>,
    private readonly mapper: WhatsappAccountMapper,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<WhatsappAccountEntity[]> {
    const records = await this.ownQuery(scope)
      .orderBy('account.createdAt', 'ASC')
      .addOrderBy('account.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<WhatsappAccountEntity>> {
    const record = await this.ownQuery(scope).andWhere('account.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByHostForSystem(hostId: string): Promise<Option<WhatsappAccountEntity>> {
    const record = await this.repository.findOneBy({ hostId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(account: WhatsappAccountEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(account));
  }

  async save(account: WhatsappAccountEntity): Promise<void> {
    const {
      id,
      organizationId,
      userId,
      hostId: _hostId,
      ...changes
    } = this.mapper.toPersistence(account);
    await this.repository.update({ id, organizationId, userId }, changes);
  }

  async delete(account: WhatsappAccountEntity): Promise<void> {
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
