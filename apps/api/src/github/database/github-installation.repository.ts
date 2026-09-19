import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { GithubErrors } from '../domain/github.errors';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';
import { InstallationResource } from '../github.resource';
import { GithubInstallationMapper } from '../github-installation.mapper';
import { GithubInstallationOrmEntity } from './github-installation.orm-entity';
import type {
  GithubInstallationRepositoryPort,
  InstallationStatusChange,
} from './github-installation.repository.port';

/** Postgres' unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

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
    await this.claiming(entity, () =>
      this.outbox.writeWithEvents([entity], (manager) =>
        manager.getRepository(GithubInstallationOrmEntity).insert(record),
      ),
    );
  }

  async save(entity: GithubInstallationEntity): Promise<GithubInstallationEntity> {
    const record = await this.claiming(entity, () =>
      this.outbox.writeWithEvents([entity], (manager) =>
        manager.getRepository(GithubInstallationOrmEntity).save(this.mapper.toPersistence(entity)),
      ),
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

  async findLiveByGithubInstallationId(
    githubInstallationId: number,
  ): Promise<Option<GithubInstallationEntity>> {
    const record = await this.unscopedQuery(
      'GitHub sends the installation webhook with no notion of our tenants, and the claim check exists to find another workspace’s row',
    )
      // A bigint column, which the driver compares as a string.
      .andWhere('installation.githubInstallationId = :githubInstallationId', {
        githubInstallationId: String(githubInstallationId),
      })
      .andWhere('installation.deletedAt IS NULL')
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findDisconnectedForOrganization(
    organizationId: string,
    githubInstallationId: number,
  ): Promise<Option<GithubInstallationEntity>> {
    const record = await this.unscopedQuery(
      'the reconnect path names its own organization explicitly, before a request scope is available to the connect command',
    )
      .andWhere('installation.organizationId = :organizationId', { organizationId })
      .andWhere('installation.githubInstallationId = :githubInstallationId', {
        githubInstallationId: String(githubInstallationId),
      })
      .andWhere('installation.deletedAt IS NOT NULL')
      .orderBy('installation.deletedAt', 'DESC')
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

  async applyStatusChange(change: InstallationStatusChange): Promise<boolean> {
    const patch: Partial<GithubInstallationOrmEntity> = {};
    if (change.suspendedAt !== undefined) patch.suspendedAt = change.suspendedAt;
    if (change.deletedAt !== undefined) patch.deletedAt = change.deletedAt;

    // One statement, only the named columns, and only while the row is live —
    // so a delivery that read the world before a disconnect committed cannot
    // write `deletedAt` back to null and resurrect a claim.
    const result = await this.repository
      .createQueryBuilder()
      .update(GithubInstallationOrmEntity)
      .set({ ...patch, updatedAt: new Date() })
      .where('"githubInstallationId" = :githubInstallationId', {
        githubInstallationId: String(change.githubInstallationId),
      })
      .andWhere('"deletedAt" IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * Run a write that claims a GitHub installation id, reporting the partial
   * unique index's refusal as the 409 the endpoint documents.
   *
   * The handler checks for a live claim first, but that check and this write are
   * not one statement: two workspaces posting the same installation in the same
   * moment both pass it, and without this one of them would get a 500 from the
   * constraint the 409 is supposedly held up by.
   */
  private async claiming<T>(entity: GithubInstallationEntity, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new AppError(GithubErrors.INSTALLATION_ALREADY_CONNECTED, {
        detail: 'Another workspace connected that installation a moment ago.',
        extensions: { githubInstallationId: entity.githubInstallationId },
      });
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;
}
