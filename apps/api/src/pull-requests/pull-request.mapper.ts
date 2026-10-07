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
  GithubPullRequestSummary,
  GithubReviewComment,
} from '../github/infrastructure/github-pulls.port';
import {
  type AnalyticsWindow,
  barsOf,
  bucketOf,
  hoursBetween,
  median,
  mondayOf,
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
    const decision = decideLane(snapshot.files.value, pull.additions, pull.deletions);
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
      checks: snapshot.checks.value?.state ?? 'unavailable',
      checksRefusal: snapshot.checks.refusal,
      unread: [
        ...(snapshot.files.refusal ? (['files'] as const) : []),
        ...(snapshot.reviews.refusal ? (['reviews'] as const) : []),
      ],
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
      // Something in this answer has parts nobody has read yet, so the next
      // read will deepen it: the client polls while that holds (#247).
      filling: reads.some((read) =>
        read.snapshots.some(
          (s) =>
            (s.files.value === null && s.files.refusal === null) ||
            (s.checks.value === null && s.checks.refusal === null) ||
            (s.reviews.value === null && s.reviews.refusal === null),
        ),
      ),
      unreadable: this.toUnreadable(reads),
    };
  }

  /** Every gap the reads left, with GitHub's own refusal, once per repository, part and refusal (#244). */
  toUnreadable(reads: RepositoryPulls[]): UnreadableRepositoryDto[] {
    const gaps = new Map<string, UnreadableRepositoryDto>();
    for (const read of reads) {
      for (const gap of read.gaps) {
        const entry = { fullName: read.repository.fullName, what: gap.what, refusal: gap.refusal };
        gaps.set(`${entry.fullName}|${entry.what}|${entry.refusal}`, entry);
      }
    }
    return [...gaps.values()];
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
      folders: foldersOf(snapshot.files.value ?? []),
      checkCounts: snapshot.checks.value ?? {
        state: 'unavailable',
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
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
    /** Every pull request the window holds, as its listing gave it: what the figures count. */
    counted: GithubPullRequestSummary[];
    viewerLogin: string | null;
    now: Date;
    complete: boolean;
    unreadable: UnreadableRepositoryDto[];
  }): PullRequestAnalyticsResponseDto {
    const { window, viewerLogin, now } = input;
    const all = dedupe([...input.open, ...input.closed]);
    // A figure counts listings, not snapshots: a pull request this read had no
    // budget to fill is still one that was opened or merged, and the numbers
    // must not move with how much of it we happened to read (#247). The
    // medians and the lane mix below stay on what was read, and deepen.
    const everyPull = dedupePulls([...all.map((s) => s.pull), ...input.counted]);
    const figure = (at: (pull: GithubPullRequestSummary) => string | null) => ({
      value: everyPull.filter((pull) => periodOf(at(pull), window) === 'current').length,
      previous: everyPull.filter((pull) => periodOf(at(pull), window) === 'previous').length,
    });
    // What only a read can answer — who reviewed, and when — is counted over
    // what was read, and grows as later views fill more.
    const readFigure = (at: (s: PullRequestSnapshot) => string | null) => ({
      value: all.filter((s) => periodOf(at(s), window) === 'current').length,
      previous: all.filter((s) => periodOf(at(s), window) === 'previous').length,
    });
    // Unread reviews count in neither review figure: GitHub saying no is not nobody reviewing.
    const reviewedAt = (s: PullRequestSnapshot) =>
      viewerLogin
        ? (s.reviews.value?.find((r) => r.login === viewerLogin && r.submittedAt)?.submittedAt ??
          null)
        : null;
    const firstReviewHours = (s: PullRequestSnapshot) => {
      if (!s.reviews.value) return null;
      const first = s.reviews.value
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
    const created = (pull: GithubPullRequestSummary) => pull.createdAt;
    const merged = (pull: GithubPullRequestSummary) => pull.mergedAt;
    const createdOf = (s: PullRequestSnapshot) => s.pull.createdAt;
    const mergedOf = (s: PullRequestSnapshot) => s.pull.mergedAt;
    // One bar per day, or per week over a quarter, as the artboard draws it.
    const bucket = bucketOf(input.range);
    const barOf = (at: string) => (bucket === 'week' ? mondayOf(at.slice(0, 10)) : at.slice(0, 10));
    const days = barsOf(window, bucket).map((date) => ({
      date,
      created: everyPull.filter((pull) => barOf(pull.createdAt) === date).length,
      merged: everyPull.filter((pull) => pull.mergedAt && barOf(pull.mergedAt) === date).length,
    }));
    // The lane mix counts only pull requests whose files were read: a guessed lane would skew it.
    const laneOf = (s: PullRequestSnapshot) =>
      s.files.value ? decideLane(s.files.value, s.pull.additions, s.pull.deletions).lane : null;
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
      reviewedByYou: readFigure(reviewedAt),
      waitForReview: medianOf(() => true, firstReviewHours, createdOf),
      waitForReviewAgents: medianOf(
        (s) => isSessionBranch(s.pull.headRef),
        firstReviewHours,
        createdOf,
      ),
      waitForReviewPeople: medianOf(
        (s) => !isSessionBranch(s.pull.headRef),
        firstReviewHours,
        createdOf,
      ),
      timeToMerge: medianOf(
        (s) => s.pull.mergedAt !== null,
        (s) => hoursBetween(s.pull.createdAt, s.pull.mergedAt as string),
        mergedOf,
      ),
      days,
      bucket,
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
      checks: snapshot.checks.value?.state ?? 'unavailable',
      verdicts: latestVerdicts(snapshot.reviews.value ?? [], pull.authorLogin),
    };
  }

  private reviewersOf(snapshot: PullRequestSnapshot): PullRequestReviewerDto[] {
    const reviewed = new Map<string, PullRequestReviewerDto['state']>();
    for (const review of snapshot.reviews.value ?? []) {
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

/**
 * The same pull request reached twice — once as a snapshot's own detail, once
 * as a listing row — is one pull request. Keyed by the html URL, which names
 * the repository and the number without either being carried separately.
 */
function dedupePulls(pulls: GithubPullRequestSummary[]): GithubPullRequestSummary[] {
  const seen = new Map<string, GithubPullRequestSummary>();
  for (const pull of pulls) seen.set(pull.htmlUrl, pull);
  return [...seen.values()];
}
