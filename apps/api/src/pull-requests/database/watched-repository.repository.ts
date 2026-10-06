import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { Repository } from 'typeorm';
import { PullRequestResource } from '../pull-requests.resource';
import { WatchedRepositoryOrmEntity } from './watched-repository.orm-entity';
import type {
  RepositoryWatch,
  WatchedRepositoryRepositoryPort,
} from './watched-repository.repository.port';

@Injectable()
export class WatchedRepositoryRepository
  extends ScopedRepositoryBase<WatchedRepositoryOrmEntity>
  implements WatchedRepositoryRepositoryPort
{
  protected readonly resource = PullRequestResource;
  protected readonly alias = 'watch';

  constructor(
    @InjectRepository(WatchedRepositoryOrmEntity)
    protected readonly repository: Repository<WatchedRepositoryOrmEntity>,
  ) {
    super();
  }

  async findOwn(scope: AccessScope): Promise<RepositoryWatch[]> {
    // The workspace clause is the scope's; the person is this repository's.
    const rows = await this.scopedQuery(scope)
      .andWhere('watch.userId = :userId', { userId: scope.userId })
      .getMany();
    return rows.map((row) => ({
      installationId: row.installationId,
      githubRepoId: Number(row.githubRepoId),
    }));
  }

  async watch(scope: AccessScope, watch: RepositoryWatch): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(this.rowOf(scope, watch))
      .orIgnore()
      .execute();
  }

  async unwatch(scope: AccessScope, watch: RepositoryWatch): Promise<void> {
    await this.repository.delete(this.rowOf(scope, watch));
  }

  private rowOf(scope: AccessScope, watch: RepositoryWatch) {
    return {
      organizationId: scope.organizationId as string,
      userId: scope.userId,
      installationId: watch.installationId,
      githubRepoId: String(watch.githubRepoId),
    };
  }
}
