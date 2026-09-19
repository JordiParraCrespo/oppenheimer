import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { HostPairingTokenEntity } from '../domain/host-pairing-token.entity';
import { HostPairingTokenMapper } from '../host-pairing-token.mapper';
import { HostPairingTokenResource } from '../host-pairing-token.resource';
import { HostPairingTokenOrmEntity } from './host-pairing-token.orm-entity';
import type { HostPairingTokenRepositoryPort } from './host-pairing-token.repository.port';

/**
 * TypeORM adapter for the pairing-token aggregate.
 *
 * Scope-enforced like every other repository, against a declaration whose only
 * dimension is the person who minted the token.
 */
@Injectable()
export class HostPairingTokenRepository
  extends ScopedRepositoryBase<HostPairingTokenOrmEntity>
  implements HostPairingTokenRepositoryPort
{
  protected readonly resource = HostPairingTokenResource;
  protected readonly alias = 'token';

  constructor(
    @InjectRepository(HostPairingTokenOrmEntity)
    protected readonly repository: Repository<HostPairingTokenOrmEntity>,
    private readonly mapper: HostPairingTokenMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async insert(entity: HostPairingTokenEntity): Promise<void> {
    const record = this.mapper.toPersistence(entity);
    await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(HostPairingTokenOrmEntity).insert(record),
    );
  }

  async save(entity: HostPairingTokenEntity): Promise<HostPairingTokenEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(HostPairingTokenOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findAll(scope: AccessScope): Promise<HostPairingTokenEntity[]> {
    const records = await this.scopedQuery(scope).orderBy('token.createdAt', 'DESC').getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<HostPairingTokenEntity>> {
    const record = await this.scopedQuery(scope).andWhere('token.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByHash(tokenHash: string): Promise<Option<HostPairingTokenEntity>> {
    const record = await this.unscopedQuery(
      'the presented secret is the credential; a machine redeeming a token has no access scope',
    )
      .where('token.tokenHash = :tokenHash', { tokenHash })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }
}
