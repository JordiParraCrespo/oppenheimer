import { Injectable } from '@nestjs/common';
import type {
  PullRequestAnalyticsRange,
  PullRequestLane,
  PullRequestScope,
} from '@oppenheimer/shared';
import type {
  PullRequestSnapshot,
  RepositoryPulls,
  WorkspaceRepository,
} from '../github/application/pull-request-access.port';
import type {
  GithubPullRequestFile,
  GithubReviewComment,
} from '../github/infrastructure/github-pulls.port';
import {
  type AnalyticsWindow,
  daysOf,
  hoursBetween,
  median,
  periodOf,
} from './domain/pull-request-analytics.policy';
import { decideLane } from './domain/pull-request-lane.policy';
import {
  isSessionBranch,
  latestVerdicts,
  type MergeBlocker,
  type MergeFacts,
  mergeBlocker,
  mergeGates,
  scopeOf,
} from './domain/pull-request-merge.policy';
import type {
  PullRequestCommentDto,
  PullRequestDetailResponseDto,
  PullRequestFileDto,
  PullRequestQueueResponseDto,
  PullRequestReviewerDto,
  PullRequestRowDto,
  UnreadableRepositoryDto,
  WatchedRepositoryDto,
} from './dtos/pull-request.response.dto';
import type { PullRequestAnalyticsResponseDto } from './dtos/pull-request-analytics.response.dto';

const LANES: PullRequestLane[] = ['deep', 'medium', 'quick'];

/**
 * Every shape the Pull requests area answers, built from GitHub's snapshots and
 * the domain's policies. Pure: no DI, no I/O.
 */
@Injectable()
export class PullRequestMapper {
  toRow(snapshot: PullRequestSnapshot, viewerLogin: string | null, now: Date): PullRequestRowDto {
    const { pull, repository } = snapshot;
    const decision = decideLane(pathsOf(snapshot), pull.additions, pull.deletions);
    return {
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      repository: repository.fullName,
      number: pull.number,
      title: pull.title,
      author: pull.authorLogin,
      authorKind: isSessionBranch(pull.headRef) ? 'session' : 'person',
      headRef: pull.headRef,
      scope: scopeOf(pull, viewerLogin),
      lane: decision.lane,
      laneReason: decision.reason,
      additions: pull.additions,
      deletions: pull.deletions,
      checks: snapshot.checks.state,
      checksRefusal: snapshot.checks.refusal ?? null,
      unread: snapshot.missing.filter((part): part is 'files' | 'reviews' => part !== 'checks'),
      mergeable: pull.mergeable !== false && pull.mergeableState !== 'dirty',
      blocker: mergeBlocker(this.factsOf(snapshot)),
      waitingSeconds: Math.max(
        0,
        Math.round((now.getTime() - new Date(pull.createdAt).getTime()) / 1000),
      ),
      draft: pull.draft,
      htmlUrl: pull.htmlUrl,
    };
  }

  toQueue(
    rows: PullRequestRowDto[],
    scope: PullRequestScope,
    viewerLogin: string | null,
    reads: RepositoryPulls[],
  ): PullRequestQueueResponseDto {
    const items = rows
      .filter((row) => row.scope === scope)
      .sort((a, b) => b.waitingSeconds - a.waitingSeconds);
    const count = (predicate: (row: PullRequestRowDto) => boolean) =>
      items.filter(predicate).length;
    return {
      items,
      scopes: {
        mine: rows.filter((row) => row.scope === 'mine').length,
        requested: rows.filter((row) => row.scope === 'requested').length,
        watching: rows.filter((row) => row.scope === 'watching').length,
      },
      lanes: {
        deep: count((r) => r.lane === 'deep'),
        medium: count((r) => r.lane === 'medium'),
        quick: count((r) => r.lane === 'quick'),
      },
      readyToMerge: count((row) => row.blocker === null),
      withConflicts: count((row) => row.blocker === 'conflicts'),
      oldestWaitingSeconds: items[0]?.waitingSeconds ?? null,
      viewerLogin,
      unreadable: this.toUnreadable(reads),
      checksRefused: rows.some((row) => row.checksRefusal === 'forbidden'),
    };
  }

  /** The repositories a read could not fully answer, by name and why (#244). */
  toUnreadable(reads: RepositoryPulls[]): UnreadableRepositoryDto[] {
    const byName = new Map<string, UnreadableRepositoryDto>();
    for (const read of reads) {
      if (!(read.refusal || read.partial) || byName.has(read.repository.fullName)) continue;
      byName.set(read.repository.fullName, {
        fullName: read.repository.fullName,
        refusal: read.refusal ?? 'failed',
        partial: read.partial,
      });
    }
    return [...byName.values()];
  }

  toDetail(
    snapshot: PullRequestSnapshot,
    viewerLogin: string | null,
    now: Date,
  ): PullRequestDetailResponseDto {
    const { pull } = snapshot;
    const gates = mergeGates(this.factsOf(snapshot));
    return {
      ...this.toRow(snapshot, viewerLogin, now),
      body: pull.body,
      baseRef: pull.baseRef,
      state: pull.merged ? 'merged' : pull.state,
      changedFiles: pull.changedFiles,
      folders: foldersOf(snapshot.filePaths),
      checkCounts: {
        state: snapshot.checks.state,
        total: snapshot.checks.total,
        passed: snapshot.checks.passed,
        failed: snapshot.checks.failed,
        pending: snapshot.checks.pending,
      },
      gates: (['checks', 'conflicts', 'review', 'merge'] as const).map((id) => ({
        id,
        state: gates[id],
      })),
      reviewers: this.reviewersOf(snapshot),
      viewerLogin,
    };
  }

  toFile(file: GithubPullRequestFile): PullRequestFileDto {
    return {
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    };
  }

  toComment(comment: GithubReviewComment): PullRequestCommentDto {
    return {
      id: comment.id,
      path: comment.path,
      line: comment.line,
      side: comment.side,
      body: comment.body,
      author: comment.login,
      createdAt: comment.createdAt,
    };
  }

  toWatch(repository: WorkspaceRepository, watching: boolean): WatchedRepositoryDto {
    return {
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      private: repository.private,
      watching,
    };
  }

  toAnalytics(input: {
    range: PullRequestAnalyticsRange;
    window: AnalyticsWindow;
    open: PullRequestSnapshot[];
    closed: PullRequestSnapshot[];
    viewerLogin: string | null;
    now: Date;
    complete: boolean;
    closedCeiling: number;
    unreadable: UnreadableRepositoryDto[];
  }): PullRequestAnalyticsResponseDto {
    const { window, viewerLogin, now } = input;
    const all = dedupe([...input.open, ...input.closed]);
    const figure = (at: (s: PullRequestSnapshot) => string | null) => ({
      value: all.filter((s) => periodOf(at(s), window) === 'current').length,
      previous: all.filter((s) => periodOf(at(s), window) === 'previous').length,
    });
    // A snapshot whose reviews GitHub did not give counts in neither review figure (an empty list is not "no reviews").
    const reviewsRead = (s: PullRequestSnapshot) => !s.missing.includes('reviews');
    const reviewedAt = (s: PullRequestSnapshot) =>
      viewerLogin && reviewsRead(s)
        ? (s.reviews.find((r) => r.login === viewerLogin && r.submittedAt)?.submittedAt ?? null)
        : null;
    const firstReviewHours = (s: PullRequestSnapshot) => {
      if (!reviewsRead(s)) return null;
      const first = s.reviews
        .filter((r) => r.login !== s.pull.authorLogin && r.submittedAt)
        .map((r) => r.submittedAt as string)
        .sort()[0];
      return first ? hoursBetween(s.pull.createdAt, first) : null;
    };
    const medianOf = (
      filter: (s: PullRequestSnapshot) => boolean,
      measure: (s: PullRequestSnapshot) => number | null,
      at: (s: PullRequestSnapshot) => string | null,
    ) => {
      const values = (period: 'current' | 'previous') =>
        all
          .filter((s) => filter(s) && periodOf(at(s), window) === period)
          .map(measure)
          .filter((v): v is number => v !== null);
      return { value: median(values('current')), previous: median(values('previous')) };
    };
    const created = (s: PullRequestSnapshot) => s.pull.createdAt;
    const merged = (s: PullRequestSnapshot) => s.pull.mergedAt;
    const days = daysOf(window).map((date) => ({
      date,
      created: all.filter((s) => s.pull.createdAt.slice(0, 10) === date).length,
      merged: all.filter((s) => s.pull.mergedAt?.slice(0, 10) === date).length,
    }));
    // The lane mix counts only pull requests whose files were read: a guessed lane would skew it.
    const laneOf = (s: PullRequestSnapshot) =>
      s.missing.includes('files')
        ? null
        : decideLane(s.filePaths, s.pull.additions, s.pull.deletions).lane;
    const waiting = new Map<MergeBlocker, number[]>();
    for (const s of input.open) {
      const blocker = mergeBlocker(this.factsOf(s));
      if (!blocker) continue;
      waiting.set(blocker, [...(waiting.get(blocker) ?? []), hoursBetween(s.pull.createdAt, now)]);
    }

    return {
      range: input.range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      created: figure(created),
      merged: figure(merged),
      reviewedByYou: figure(reviewedAt),
      waitForReview: medianOf(() => true, firstReviewHours, created),
      waitForReviewAgents: medianOf(
        (s) => isSessionBranch(s.pull.headRef),
        firstReviewHours,
        created,
      ),
      waitForReviewPeople: medianOf(
        (s) => !isSessionBranch(s.pull.headRef),
        firstReviewHours,
        created,
      ),
      timeToMerge: medianOf(
        (s) => s.pull.mergedAt !== null,
        (s) => hoursBetween(s.pull.createdAt, s.pull.mergedAt as string),
        merged,
      ),
      days,
      lanes: LANES.map((lane) => ({
        lane,
        value: all.filter(
          (s) => laneOf(s) === lane && periodOf(s.pull.mergedAt, window) === 'current',
        ).length,
        previous: all.filter(
          (s) => laneOf(s) === lane && periodOf(s.pull.mergedAt, window) === 'previous',
        ).length,
      })),
      waiting: [...waiting.entries()]
        .map(([reason, hours]) => ({ reason, value: hours.length, medianHours: median(hours) }))
        .sort((a, b) => b.value - a.value),
      complete: input.complete,
      closedCeiling: input.closedCeiling,
      unreadable: input.unreadable,
    };
  }

  private factsOf(snapshot: PullRequestSnapshot): MergeFacts {
    const { pull } = snapshot;
    return {
      draft: pull.draft,
      merged: pull.merged,
      state: pull.state,
      mergeable: pull.mergeable,
      mergeableState: pull.mergeableState,
      checks: snapshot.checks.state,
      verdicts: latestVerdicts(snapshot.reviews, pull.authorLogin),
    };
  }

  private reviewersOf(snapshot: PullRequestSnapshot): PullRequestReviewerDto[] {
    const reviewed = new Map<string, PullRequestReviewerDto['state']>();
    for (const review of snapshot.reviews) {
      if (review.login === snapshot.pull.authorLogin) continue;
      const state =
        review.state === 'APPROVED'
          ? 'approved'
          : review.state === 'CHANGES_REQUESTED'
            ? 'changes_requested'
            : review.state === 'COMMENTED'
              ? 'commented'
              : null;
      if (state && !(state === 'commented' && reviewed.has(review.login)))
        reviewed.set(review.login, state);
    }
    for (const login of snapshot.pull.requestedReviewers) reviewed.set(login, 'requested');
    return [...reviewed.entries()].map(([login, state]) => ({ login, state }));
  }
}

/** Top-level directories, most-touched first; a file at the root counts as `/`. */
function foldersOf(paths: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const folder = path.includes('/') ? `${path.split('/')[0]}/` : '/';
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([folder]) => folder);
}

function dedupe(snapshots: PullRequestSnapshot[]): PullRequestSnapshot[] {
  const seen = new Map<string, PullRequestSnapshot>();
  for (const s of snapshots)
    seen.set(`${s.repository.installationId}:${s.repository.githubRepoId}:${s.pull.number}`, s);
  return [...seen.values()];
}

/** The paths the lane policy reads; `null` when GitHub did not give the files. */
function pathsOf(snapshot: PullRequestSnapshot): string[] | null {
  return snapshot.missing.includes('files') ? null : snapshot.filePaths;
}
