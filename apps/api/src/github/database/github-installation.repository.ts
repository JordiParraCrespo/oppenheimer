import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';
import { InstallationResource } from '../github.resource';
import { GithubInstallationMapper } from '../github-installation.mapper';
import { GithubInstallationOrmEntity } from './github-installation.orm-entity';
import type { GithubInstallationRepositoryPort } from './github-installation.repository.port';

/**
 * TypeORM adapter for the installation aggregate. Translates domain ↔
 * persistence via the mapper and stages domain events on the transactional
 * outbox atomically with the write that raised them.
 *
 * Note what is absent from the scoped reads: no `WHERE organizationId = ...`.
 * Extending `ScopedRepositoryBase` and naming the resource is the whole of it,
 * so a query and an `ability.can()` cannot disagree.
 */
@Injectable()
export class GithubInstallationRepository
  extends ScopedRepositoryBase<GithubInstallationOrmEntity>
  implements GithubInstallationRepositoryPort
{
  protected readonly resource = InstallationResource;
  protected readonly alias = 'installation';

  constructor(
    @InjectRepository(GithubInstallationOrmEntity)
    protected readonly repository: Repository<GithubInstallationOrmEntity>,
    private readonly mapper: GithubInstallationMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async insert(entity: GithubInstallationEntity): Promise<void> {
    const record = this.mapper.toPersistence(entity);
    await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(GithubInstallationOrmEntity).insert(record),
    );
  }

  async save(entity: GithubInstallationEntity): Promise<GithubInstallationEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(GithubInstallationOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findAll(scope: AccessScope): Promise<GithubInstallationEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('installation.deletedAt IS NULL')
      .orderBy('installation.createdAt', 'DESC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<GithubInstallationEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('installation.id = :id', { id })
      .andWhere('installation.deletedAt IS NULL')
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByGithubInstallationId(
    githubInstallationId: number,
  ): Promise<Option<GithubInstallationEntity>> {
    const record = await this.unscopedQuery(
      'GitHub sends the installation webhook with no notion of our tenants, and the claim check exists to find another workspace’s row',
    )
      // The column is a bigint, which the driver compares as a string.
      .andWhere('installation.githubInstallationId = :githubInstallationId', {
        githubInstallationId: String(githubInstallationId),
      })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByIdForTokenMint(id: string): Promise<Option<GithubInstallationEntity>> {
    const record = await this.unscopedQuery(
      'a repository token is minted for a host, not for a caller, so there is no request scope to apply',
    )
      .andWhere('installation.id = :id', { id })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }
}
