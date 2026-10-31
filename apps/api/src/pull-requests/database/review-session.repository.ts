import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import { PullRequestResource } from '../pull-requests.resource';
import { ReviewSessionOrmEntity } from './review-session.orm-entity';
import type {
  ReviewSessionLink,
  ReviewSessionRepositoryPort,
  ReviewSessionRow,
} from './review-session.repository.port';

/** How many review sessions the For review list holds: a person's open ones, never a page of them. */
const OPEN_LIMIT = 100;

@Injectable()
export class ReviewSessionRepository
  extends ScopedRepositoryBase<ReviewSessionOrmEntity>
  implements ReviewSessionRepositoryPort
{
  protected readonly resource = PullRequestResource;
  protected readonly alias = 'review';

  constructor(
    @InjectRepository(ReviewSessionOrmEntity)
    protected readonly repository: Repository<ReviewSessionOrmEntity>,
  ) {
    super();
  }

  async link(scope: AccessScope, link: ReviewSessionLink): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        sessionId: link.sessionId,
        organizationId: scope.organizationId as string,
        userId: scope.userId,
        installationId: link.installationId,
        githubRepoId: String(link.githubRepoId),
        number: link.number,
        repository: link.repository,
        title: link.title,
        headRef: link.headRef,
      })
      .orIgnore()
      .execute();
  }

  async findOpen(scope: AccessScope): Promise<ReviewSessionRow[]> {
    // The workspace clause is the scope's; the person is this repository's.
    // The session's lifecycle is the sessions module's column, read by the
    // ids this person's rows already name. A session whose delete is owed to
    // its host is gone from the reader's point of view, so it leaves the list
    // on the ask rather than when an offline host gets round to it; one the
    // host refused to delete comes back.
    const rows = await this.scopedQuery(scope)
      .andWhere('review.userId = :userId', { userId: scope.userId })
      .innerJoin(
        'work_session',
        'session',
        `"session"."id" = review.sessionId AND "session"."organizationId" = review.organizationId`,
      )
      .andWhere(`"session"."state" <> 'resolved'`)
      .andWhere(`"session"."closeRequestedAt" IS NULL`)
      .select([
        'review.sessionId AS "sessionId"',
        'review.installationId AS "installationId"',
        'review.githubRepoId AS "githubRepoId"',
        'review.number AS "number"',
        'review.repository AS "repository"',
        'review.title AS "title"',
        'review.headRef AS "headRef"',
        'review.createdAt AS "createdAt"',
        '"session"."hostId" AS "hostId"',
        '"session"."state" AS "state"',
      ])
      .orderBy('review.createdAt', 'DESC')
      .limit(OPEN_LIMIT)
      .getRawMany<Record<string, unknown>>();
    return rows.map((row) => ({
      sessionId: String(row.sessionId),
      installationId: String(row.installationId),
      githubRepoId: Number(row.githubRepoId),
      number: Number(row.number),
      repository: String(row.repository),
      title: String(row.title),
      headRef: String(row.headRef),
      hostId: String(row.hostId),
      state: String(row.state),
      createdAt: new Date(row.createdAt as string | Date),
    }));
  }
}
