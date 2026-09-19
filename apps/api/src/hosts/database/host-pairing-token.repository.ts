import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { HostPairingTokenEntity } from '../domain/host-pairing-token.entity';
import { HostPairingTokenMapper } from '../host-pairing-token.mapper';
import { HostResource } from '../hosts.resource';
import { HostPairingTokenOrmEntity } from './host-pairing-token.orm-entity';
import type { HostPairingTokenRepositoryPort } from './host-pairing-token.repository.port';

/**
 * TypeORM adapter for the pairing-token aggregate.
 *
 * Scope-enforced against **`HostResource`**, not a declaration of its own: a
 * pairing token is how a host comes to exist, the routes that mint and revoke
 * one are `create Host` and `delete Host`, and the column it is filtered by is
 * the same `ownerUserId` a host carries. A second resource would be a column
 * map masquerading as a noun, and the day a host is shared by `access_grant`
 * the two listings would diverge with nothing in the policy table to explain it.
 */
@Injectable()
export class HostPairingTokenRepository
  extends ScopedRepositoryBase<HostPairingTokenOrmEntity>
  implements HostPairingTokenRepositoryPort
{
  protected readonly resource = HostResource;
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
