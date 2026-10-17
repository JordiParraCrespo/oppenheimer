import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ReviewSessionRepositoryPort } from '../../database/review-session.repository.port';
import type { ReviewSessionDto } from '../../dtos/review-session.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { REVIEW_SESSION_REPOSITORY } from '../../pull-requests.di-tokens';
import { FindReviewSessionsQuery } from './find-review-sessions.query';

/** The For review list: the caller's review sessions not closed, newest first. */
@QueryHandler(FindReviewSessionsQuery)
export class FindReviewSessionsQueryHandler
  implements IQueryHandler<FindReviewSessionsQuery, ReviewSessionDto[]>
{
  constructor(
    @Inject(REVIEW_SESSION_REPOSITORY)
    private readonly reviews: ReviewSessionRepositoryPort,
    private readonly mapper: PullRequestMapper,
  ) {}

  async execute({ scope }: FindReviewSessionsQuery): Promise<ReviewSessionDto[]> {
    return (await this.reviews.findOpen(scope)).map((row) => this.mapper.toReviewSession(row));
  }
}
