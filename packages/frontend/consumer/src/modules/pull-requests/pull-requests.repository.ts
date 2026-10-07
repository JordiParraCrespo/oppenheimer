import {
  heyApiSdk,
  type PullRequestAnalyticsResponseDto,
  type PullRequestDetailResponseDto,
  type PullRequestQueueResponseDto,
  type PullRequestRowDto,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  type LaneReason,
  type LineCommentInput,
  type MergeMethod,
  type PullRequestAddress,
  type PullRequestAnalytics,
  type PullRequestAnalyticsRange,
  type PullRequestComment,
  PullRequestDetailEntity,
  PullRequestEntity,
  type PullRequestFile,
  type PullRequestQueue,
  type PullRequestScope,
  type ReviewInput,
  type WatchedRepository,
} from './pull-request.entity';
import { PullRequestsErrors } from './pull-requests.errors';

function laneReasonOf(dto: PullRequestRowDto['laneReason']): LaneReason {
  const lines = dto.lines ?? 0;
  const files = dto.files ?? 0;
  switch (dto.code) {
    case 'risky_path':
      return { code: 'risky_path', path: dto.path ?? '' };
    case 'large_change':
      return { code: 'large_change', lines };
    case 'docs_tests_config':
      return { code: 'docs_tests_config', files };
    case 'small_change':
      return { code: 'small_change', lines, files };
    case 'files_unread':
      return { code: 'files_unread', lines };
    default:
      return { code: 'medium_change', lines, files };
  }
}

function toEntity(dto: PullRequestRowDto): PullRequestEntity {
  return new PullRequestEntity(
    dto.installationId,
    dto.githubRepoId,
    dto.repository,
    dto.number,
    dto.title,
    dto.author,
    dto.authorKind,
    dto.headRef,
    dto.scope,
    dto.lane,
    laneReasonOf(dto.laneReason),
    dto.additions,
    dto.deletions,
    dto.checks,
    dto.mergeable,
    dto.blocker ?? null,
    dto.waitingSeconds,
    dto.draft,
    dto.htmlUrl,
    dto.checksRefusal,
    dto.unread,
  );
}

function toQueue(dto: PullRequestQueueResponseDto): PullRequestQueue {
  return {
    items: dto.items.map(toEntity),
    scopes: dto.scopes,
    lanes: dto.lanes,
    readyToMerge: dto.readyToMerge,
    withConflicts: dto.withConflicts,
    oldestWaitingSeconds: dto.oldestWaitingSeconds ?? null,
    viewerLogin: dto.viewerLogin ?? null,
    filling: dto.filling,
    unreadable: dto.unreadable,
  };
}

function toDetail(dto: PullRequestDetailResponseDto): PullRequestDetailEntity {
  return new PullRequestDetailEntity(
    toEntity(dto),
    dto.body,
    dto.baseRef,
    dto.state,
    dto.changedFiles,
    dto.folders,
    {
      total: dto.checkCounts.total,
      passed: dto.checkCounts.passed,
      failed: dto.checkCounts.failed,
      pending: dto.checkCounts.pending,
    },
    dto.gates,
    dto.reviewers,
    dto.viewerLogin ?? null,
  );
}

function toAnalytics(dto: PullRequestAnalyticsResponseDto): PullRequestAnalytics {
  const median = (m: { value?: number | null; previous?: number | null }) => ({
    value: m.value ?? null,
    previous: m.previous ?? null,
  });
  return {
    range: dto.range,
    complete: dto.complete,
    unreadable: dto.unreadable,
    from: dto.from,
    to: dto.to,
    created: dto.created,
    merged: dto.merged,
    reviewedByYou: dto.reviewedByYou,
    waitForReview: median(dto.waitForReview),
    waitForReviewAgents: median(dto.waitForReviewAgents),
    waitForReviewPeople: median(dto.waitForReviewPeople),
    timeToMerge: median(dto.timeToMerge),
    days: dto.days,
    bucket: dto.bucket,
    lanes: dto.lanes,
    waiting: dto.waiting.map((row) => ({
      reason: row.reason as PullRequestAnalytics['waiting'][number]['reason'],
      value: row.value,
      medianHours: row.medianHours ?? null,
    })),
  };
}

/**
 * The Pull requests area's reads and writes. Everything is GitHub's, read live
 * by the API: a review, a comment and a merge are made with the caller's own
 * GitHub token, so they land in GitHub as that person.
 */
@injectable()
export class PullRequestsRepository {
  @MapApiError(PullRequestsErrors.FETCH_QUEUE_FAILED)
  async queue(scope: PullRequestScope): Promise<PullRequestQueue> {
    const data = await unwrapBody(
      heyApiSdk.findPullRequests({ query: { scope } }),
      PullRequestsErrors.FETCH_QUEUE_FAILED,
    );
    return toQueue(data);
  }

  @MapApiError(PullRequestsErrors.FETCH_FAILED)
  async find(address: PullRequestAddress): Promise<PullRequestDetailEntity> {
    const data = await unwrapBody(
      heyApiSdk.findPullRequest({ path: address }),
      PullRequestsErrors.FETCH_FAILED,
    );
    return toDetail(data);
  }

  @MapApiError(PullRequestsErrors.FETCH_FILES_FAILED)
  async files(address: PullRequestAddress): Promise<PullRequestFile[]> {
    const data = await unwrapBody(
      heyApiSdk.findPullRequestFiles({ path: address }),
      PullRequestsErrors.FETCH_FILES_FAILED,
    );
    return data.map((file) => ({
      ...file,
      previousPath: file.previousPath ?? null,
      patch: file.patch ?? null,
    }));
  }

  @MapApiError(PullRequestsErrors.FETCH_FILES_FAILED)
  async comments(address: PullRequestAddress): Promise<PullRequestComment[]> {
    const data = await unwrapBody(
      heyApiSdk.findPullRequestComments({ path: address }),
      PullRequestsErrors.FETCH_FILES_FAILED,
    );
    return data.map((comment) => ({
      ...comment,
      line: comment.line ?? null,
      createdAt: new Date(comment.createdAt),
    }));
  }

  /** Answers whether approving also merged it; GitHub may hold the merge, and then it waits. */
  @MapApiError(PullRequestsErrors.REVIEW_FAILED)
  async submitReview(
    address: PullRequestAddress,
    review: ReviewInput,
  ): Promise<{ merged: boolean }> {
    return unwrapBody(
      heyApiSdk.submitPullRequestReview({
        path: address,
        body: {
          verdict: review.verdict,
          ...(review.body ? { body: review.body } : {}),
          comments: review.comments,
        },
      }),
      PullRequestsErrors.REVIEW_FAILED,
    );
  }

  @MapApiError(PullRequestsErrors.COMMENT_FAILED)
  async addComment(address: PullRequestAddress, comment: LineCommentInput): Promise<void> {
    await unwrap(
      heyApiSdk.addPullRequestComment({ path: address, body: comment }),
      PullRequestsErrors.COMMENT_FAILED,
    );
  }

  @MapApiError(PullRequestsErrors.MERGE_FAILED)
  async merge(address: PullRequestAddress, method: MergeMethod = 'squash'): Promise<void> {
    await unwrap(
      heyApiSdk.mergePullRequest({ path: address, body: { method } }),
      PullRequestsErrors.MERGE_FAILED,
    );
  }

  @MapApiError(PullRequestsErrors.FETCH_REPOSITORIES_FAILED)
  async repositories(): Promise<WatchedRepository[]> {
    const data = await unwrapBody(
      heyApiSdk.findWatchedRepositories(),
      PullRequestsErrors.FETCH_REPOSITORIES_FAILED,
    );
    return data.map((repository) => ({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      isPrivate: repository.private,
      watching: repository.watching,
    }));
  }

  @MapApiError(PullRequestsErrors.WATCH_FAILED)
  async setWatching(
    repository: Pick<WatchedRepository, 'installationId' | 'githubRepoId'>,
    watching: boolean,
  ): Promise<void> {
    await unwrap(
      heyApiSdk.setRepositoryWatch({
        path: { installationId: repository.installationId, githubRepoId: repository.githubRepoId },
        body: { watching },
      }),
      PullRequestsErrors.WATCH_FAILED,
    );
  }

  @MapApiError(PullRequestsErrors.FETCH_ANALYTICS_FAILED)
  async analytics(range: PullRequestAnalyticsRange): Promise<PullRequestAnalytics> {
    const data = await unwrapBody(
      heyApiSdk.findPullRequestAnalytics({ query: { range } }),
      PullRequestsErrors.FETCH_ANALYTICS_FAILED,
    );
    return toAnalytics(data);
  }
}
