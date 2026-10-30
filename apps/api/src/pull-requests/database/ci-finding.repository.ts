import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { Repository } from 'typeorm';
import { CiFindingMapper } from '../ci-finding.mapper';
import type { CiFindingEntity } from '../domain/ci-finding.entity';
import { PullRequestResource } from '../pull-requests.resource';
import { CiFindingOrmEntity } from './ci-finding.orm-entity';
import type { CiFindingHead, CiFindingRepositoryPort } from './ci-finding.repository.port';

/** The columns a second look at a check replaces; who and where stay the first row's key. */
const REPLACED: (keyof CiFindingOrmEntity)[] = [
  'rootCause',
  'relation',
  'flake',
  'action',
  'next',
  'confidence',
  'evidence',
  'recordedByUserId',
  'recordedByBotId',
  'updatedAt',
];

@Injectable()
export class CiFindingRepository
  extends ScopedRepositoryBase<CiFindingOrmEntity>
  implements CiFindingRepositoryPort
{
  protected readonly resource = PullRequestResource;
  protected readonly alias = 'finding';

  constructor(
    @InjectRepository(CiFindingOrmEntity)
    protected readonly repository: Repository<CiFindingOrmEntity>,
    private readonly mapper: CiFindingMapper,
  ) {
    super();
  }

  async record(findings: readonly CiFindingEntity[]): Promise<void> {
    if (findings.length === 0) return;
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(findings.map((finding) => this.mapper.toPersistence(finding)))
      .orUpdate(REPLACED, ['organizationId', 'githubRepoId', 'number', 'headSha', 'check'])
      .updateEntity(false)
      .execute();
  }

  async findForHead(scope: AccessScope, head: CiFindingHead): Promise<CiFindingEntity[]> {
    const rows = await this.scopedQuery(scope)
      .andWhere(
        'finding.githubRepoId = :githubRepoId AND finding.number = :number AND finding.headSha = :headSha',
        { githubRepoId: String(head.githubRepoId), number: head.number, headSha: head.headSha },
      )
      .orderBy('finding.check', 'ASC')
      .getMany();
    return rows.map((row) => this.mapper.toDomain(row));
  }
}
