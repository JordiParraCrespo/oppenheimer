import {
  heyApiSdk,
  type PullRequestAnalyticsResponseDto,
  type PullRequestDetailResponseDto,
  type PullRequestQueueResponseDto,
  type PullRequestRowDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  type LaneReason,
  type LineCommentInput,
  type MergeMethod,
  type PullRequestActivityItem,
  type PullRequestAddress,
  type PullRequestAnalytics,
  type PullRequestAnalyticsRange,
  type PullRequestComment,
  PullRequestDetailEntity,
  PullRequestEntity,
  type PullRequestEntityProps,
  type PullRequestFile,
  type PullRequestQueue,
  type PullRequestQueueName,
  type ReviewInput,
  type ReviewOutcome,
  type ReviewSession,
  sourceOf,
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
  return new PullRequestEntity(toEntityProps(dto));
}

function toEntityProps(dto: PullRequestRowDto): PullRequestEntityProps {
  return {
    installationId: sourceOf(dto.installationId),
    githubRepoId: dto.githubRepoId,
    repository: dto.repository,
    number: dto.number,
    title: dto.title,
    author: dto.author,
    authorKind: dto.authorKind,
    headRef: dto.headRef,
    scope: dto.scope,
    lane: dto.lane,
    laneReason: laneReasonOf(dto.laneReason),
    additions: dto.additions,
    deletions: dto.deletions,
    checks: dto.checks,
    mergeable: dto.mergeable,
    blocker: dto.blocker ?? null,
    waitingSeconds: dto.waitingSeconds,
    draft: dto.draft,
    htmlUrl: dto.htmlUrl,
    checksRefusal: dto.checksRefusal,
    unread: dto.unread,
    headSha: dto.headSha,
    openedAt: new Date(Math.floor(Date.now() / 1000) * 1000 - dto.waitingSeconds * 1000),
  };
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
  return new PullRequestDetailEntity({
    ...toEntityProps(dto),
    body: dto.body,
    baseRef: dto.baseRef,
    fromFork: dto.fromFork,
    state: dto.state,
    changedFiles: dto.changedFiles,
    folders: dto.folders,
    checkCounts: {
      total: dto.checkCounts.total,
      passed: dto.checkCounts.passed,
      failed: dto.checkCounts.failed,
      pending: dto.checkCounts.pending,
    },
    gates: dto.gates,
    reviewers: dto.reviewers,
    viewerLogin: dto.viewerLogin ?? null,
    failingChecks: dto.checkCounts.failing.map(({ name, url, title }) => ({ name, url, title })),
    ciFindings: dto.ciFindings.map((finding) => ({
      ...finding,
      evidence: [...finding.evidence],
      updatedAt: new Date(finding.updatedAt),
    })),
  });
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
  queue(scope: PullRequestQueueName): Promise<PullRequestQueue> {
    return callApi(PullRequestsErrors.FETCH_QUEUE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequests({ query: { scope } }));
      return toQueue(data);
    });
  }

  find(address: PullRequestAddress): Promise<PullRequestDetailEntity> {
    return callApi(PullRequestsErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequest({ path: address }));
      return toDetail(data);
    });
  }

  files(address: PullRequestAddress): Promise<PullRequestFile[]> {
    return callApi(PullRequestsErrors.FETCH_FILES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequestFiles({ path: address }));
      return data.map((file) => ({
        ...file,
        previousPath: file.previousPath ?? null,
        patch: file.patch ?? null,
      }));
    });
  }

  comments(address: PullRequestAddress): Promise<PullRequestComment[]> {
    return callApi(PullRequestsErrors.FETCH_FILES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequestComments({ path: address }));
      return data.map((comment) => ({
        ...comment,
        line: comment.line ?? null,
        createdAt: new Date(comment.createdAt),
      }));
    });
  }

  activity(address: PullRequestAddress): Promise<PullRequestActivityItem[]> {
    return callApi(PullRequestsErrors.FETCH_ACTIVITY_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequestActivity({ path: address }));
      return data.flatMap((item): PullRequestActivityItem[] => {
        const base = { id: item.id, author: item.author, at: new Date(item.at) };
        switch (item.kind) {
          case 'comment':
            return [{ ...base, kind: 'comment', body: item.body ?? '' }];
          case 'commit':
            return [{ ...base, kind: 'commit', sha: item.sha ?? '', message: item.body ?? '' }];
          case 'review':
            return item.state
              ? [{ ...base, kind: 'review', state: item.state, body: item.body ?? '' }]
              : [];
          case 'event':
            return item.event
              ? [{ ...base, kind: 'event', event: item.event, subject: item.subject ?? null }]
              : [];
          default:
            return [];
        }
      });
    });
  }

  /**
   * Answers what happened to the merge: approve and merge merges now when
   * GitHub allows it, and otherwise GitHub's auto-merge takes it once the
   * required checks pass (`autoMerge`), or it waits.
   */
  submitReview(address: PullRequestAddress, review: ReviewInput): Promise<ReviewOutcome> {
    return callApi(PullRequestsErrors.REVIEW_FAILED, async (api) => {
      return api.body(
        heyApiSdk.submitPullRequestReview({
          path: address,
          body: {
            verdict: review.verdict,
            ...(review.body ? { body: review.body } : {}),
            comments: review.comments,
          },
        }),
      );
    });
  }

  addComment(address: PullRequestAddress, comment: LineCommentInput): Promise<void> {
    return callApi(PullRequestsErrors.COMMENT_FAILED, async (api) => {
      await api.result(heyApiSdk.addPullRequestComment({ path: address, body: comment }));
    });
  }

  merge(address: PullRequestAddress, method: MergeMethod = 'squash'): Promise<void> {
    return callApi(PullRequestsErrors.MERGE_FAILED, async (api) => {
      await api.result(heyApiSdk.mergePullRequest({ path: address, body: { method } }));
    });
  }

  /** The caller's review sessions not closed, newest first. */
  reviewSessions(): Promise<ReviewSession[]> {
    return callApi(PullRequestsErrors.FETCH_REVIEW_SESSIONS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findReviewSessions());
      return data.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
    });
  }

  /**
   * Starts a review session on `hostId` and answers its id. The key belongs
   * to the attempt, as New session's does: a retry after a lost answer finds
   * the session the first one made.
   */
  startReviewSession(
    address: PullRequestAddress,
    hostId: string,
    idempotencyKey: string,
  ): Promise<string> {
    return callApi(PullRequestsErrors.START_REVIEW_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.startReviewSession({
          path: address,
          body: { hostId },
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      );
      return data.sessionId;
    });
  }

  repositories(): Promise<WatchedRepository[]> {
    return callApi(PullRequestsErrors.FETCH_REPOSITORIES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findWatchedRepositories());
      return data.map((repository) => ({
        installationId: sourceOf(repository.installationId),
        githubRepoId: repository.githubRepoId,
        fullName: repository.fullName,
        isPrivate: repository.private,
        watching: repository.watching,
      }));
    });
  }

  setWatching(
    repository: Pick<WatchedRepository, 'installationId' | 'githubRepoId'>,
    watching: boolean,
  ): Promise<void> {
    return callApi(PullRequestsErrors.WATCH_FAILED, async (api) => {
      await api.result(
        heyApiSdk.setRepositoryWatch({
          path: {
            installationId: repository.installationId,
            githubRepoId: repository.githubRepoId,
          },
          body: { watching },
        }),
      );
    });
  }

  analytics(range: PullRequestAnalyticsRange): Promise<PullRequestAnalytics> {
    return callApi(PullRequestsErrors.FETCH_ANALYTICS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPullRequestAnalytics({ query: { range } }));
      return toAnalytics(data);
    });
  }
}
