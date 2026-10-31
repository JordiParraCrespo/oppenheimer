import { assignProps } from '@oppenheimer/frontend-core';
import type {
  CiFindingAction,
  CiFindingConfidence,
  CiFindingFlake,
  CiFindingRelation,
  MergeMethod,
  PullRequestAnalyticsRange,
  PullRequestLane,
  PullRequestQueueName,
  PullRequestScope,
  ReviewVerdict,
} from '@oppenheimer/shared/schemas/pull-request';

export type {
  MergeMethod,
  PullRequestAnalyticsRange,
  PullRequestLane,
  PullRequestQueueName,
  PullRequestScope,
  ReviewVerdict,
};

/**
 * The source of a repository read through the person's own GitHub tokens: the
 * API answers its installation as null and takes this segment in its place
 * (`product/next-steps/0.2-pull-requests.md` §6.2).
 */
const TOKENS_SOURCE = 'tokens';

/** The installation a row names, or {@link TOKENS_SOURCE} for one read through a token. */
export function sourceOf(installationId: string | null): string {
  return installationId ?? TOKENS_SOURCE;
}

/**
 * A pull request is GitHub's: the console names one by the installation that
 * reaches it (or {@link TOKENS_SOURCE}), the repository and its number, and
 * keeps nothing of it (`product/next-steps/0.2-pull-requests-api-plan.md`).
 */
export interface PullRequestAddress {
  installationId: string;
  githubRepoId: number;
  number: number;
}

/** `unavailable`: GitHub would not show them, which is not the same as a commit with none. */
export type PullRequestChecks = 'passing' | 'failing' | 'running' | 'none' | 'unavailable';

/** Why GitHub did not answer a read: no access, gone, asked to wait, or no answer. */
export type ReadRefusal = 'forbidden' | 'not_found' | 'rate_limited' | 'failed';

/** What GitHub did not give on a read: what of it, and the refusal it gave. It names no repository. */
export interface UnreadableRepository {
  /** `repository`: nothing could be listed; `pull_requests`: some could not be read; else that part of some. */
  what: 'repository' | 'pull_requests' | 'files' | 'checks' | 'reviews';
  refusal: ReadRefusal;
}

/** What holds a pull request, the first that applies; null when it can merge. */
export type PullRequestBlocker =
  | 'draft'
  | 'conflicts'
  | 'checks_failing'
  | 'checks_running'
  | 'checks_unavailable'
  | 'changes_requested'
  | 'behind'
  | 'approval_required';

/** Why the lane policy put it where it is; the console words it. */
export type LaneReason =
  | { code: 'risky_path'; path: string }
  | { code: 'large_change'; lines: number }
  | { code: 'docs_tests_config'; files: number }
  | { code: 'small_change'; lines: number; files: number }
  | { code: 'medium_change'; lines: number; files: number }
  /** GitHub did not give the files: size alone, never quick. */
  | { code: 'files_unread'; lines: number };

/** What a {@link PullRequestEntity} is made from: every field, the defaulted ones optional. */
export type PullRequestEntityProps = Pick<
  PullRequestEntity,
  | 'installationId'
  | 'githubRepoId'
  | 'repository'
  | 'number'
  | 'title'
  | 'author'
  | 'authorKind'
  | 'headRef'
  | 'scope'
  | 'lane'
  | 'laneReason'
  | 'additions'
  | 'deletions'
  | 'checks'
  | 'mergeable'
  | 'blocker'
  | 'waitingSeconds'
  | 'draft'
  | 'htmlUrl'
  | 'checksRefusal'
  | 'unread'
  | 'headSha'
  | 'openedAt'
>;

/** One row of the queue. */
export class PullRequestEntity {
  readonly installationId!: string;
  readonly githubRepoId!: number;
  /** `acme-labs/xrp-mobile`. */
  readonly repository!: string;
  readonly number!: number;
  readonly title!: string;
  /** A GitHub login. */
  readonly author!: string;
  /** A session's when its branch is one a session pushed. */
  readonly authorKind!: 'session' | 'person';
  readonly headRef!: string;
  readonly scope!: PullRequestScope;
  readonly lane!: PullRequestLane;
  readonly laneReason!: LaneReason;
  readonly additions!: number;
  readonly deletions!: number;
  readonly checks!: PullRequestChecks;
  readonly mergeable!: boolean;
  readonly blocker!: PullRequestBlocker | null;
  readonly waitingSeconds!: number;
  readonly draft!: boolean;
  readonly htmlUrl!: string;
  /** Why the checks are `unavailable`; null when GitHub showed them. */
  readonly checksRefusal!: ReadRefusal | null;
  /** What GitHub did not give on this read; an unread part is not an empty one. */
  readonly unread!: readonly ('files' | 'reviews')[];
  /** The head commit this read saw: a new push is a new wait (the Inbox's key). */
  readonly headSha!: string;
  /** When it was opened, from `waitingSeconds` at the moment of the read. */
  readonly openedAt!: Date;

  constructor(props: PullRequestEntityProps) {
    assignProps(this, props);
  }

  get address(): PullRequestAddress {
    return {
      installationId: this.installationId,
      githubRepoId: this.githubRepoId,
      number: this.number,
    };
  }

  /** `xrp-mobile #12`: the repository's own name, as the queue writes it. */
  get reference(): string {
    return `${this.repository.split('/').pop() ?? this.repository} #${this.number}`;
  }

  get canMerge(): boolean {
    return this.blocker === null;
  }

  get hasConflicts(): boolean {
    return this.blocker === 'conflicts' || !this.mergeable;
  }
}

export interface PullRequestQueue {
  items: PullRequestEntity[];
  /** Watched repositories this read could not fully answer (#244). */
  unreadable: UnreadableRepository[];
  /** Some rows still have parts nobody has read; the next read fills more (#247). */
  filling: boolean;
  /** Every open pull request (`all`) and each scope's share of them. */
  scopes: Record<PullRequestQueueName, number>;
  /** Within the queue asked for. */
  lanes: Record<PullRequestLane, number>;
  readyToMerge: number;
  withConflicts: number;
  oldestWaitingSeconds: number | null;
  /** Null until the caller connects GitHub: nothing is done in their name before. */
  viewerLogin: string | null;
}

export type MergeGateId = 'checks' | 'conflicts' | 'merge';
export type MergeGateState = 'done' | 'failed' | 'pending';

export interface PullRequestReviewer {
  login: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'requested';
}

/** One check that failed on the head, as GitHub named it and summed it up. */
export interface PullRequestFailingCheck {
  name: string;
  /** Where its log or details are. */
  url: string | null;
  /** Its one-line result ("2 tests failed"). */
  title: string | null;
}

/**
 * What one failing check on the head came to, as a bot recorded it
 * (`0.2-pull-requests.md`, "CI findings").
 */
export interface CiFinding {
  id: string;
  check: string;
  rootCause: string;
  relation: CiFindingRelation;
  flake: CiFindingFlake;
  action: CiFindingAction;
  /** The action in words. */
  next: string;
  confidence: CiFindingConfidence;
  evidence: string[];
  /** The bot that recorded it; null when it is gone. */
  recordedByBotId: string | null;
  updatedAt: Date;
}

/** The briefing: the row, and what the page around it reads. */
/** What a {@link PullRequestDetailEntity} is made from: its row's props and its own fields. */
export type PullRequestDetailEntityProps = PullRequestEntityProps &
  Pick<
    PullRequestDetailEntity,
    | 'body'
    | 'baseRef'
    | 'fromFork'
    | 'state'
    | 'changedFiles'
    | 'folders'
    | 'checkCounts'
    | 'gates'
    | 'reviewers'
    | 'viewerLogin'
  > &
  Partial<Pick<PullRequestDetailEntity, 'failingChecks' | 'ciFindings'>>;

export class PullRequestDetailEntity extends PullRequestEntity {
  /** The description, as written (Markdown). */
  readonly body!: string;
  readonly baseRef!: string;
  /** The head branch is in a fork, which a session cannot check out yet. */
  readonly fromFork!: boolean;
  readonly state!: 'open' | 'merged' | 'closed';
  readonly changedFiles!: number;
  /** Top-level directories, most files first. */
  readonly folders!: string[];
  readonly checkCounts!: { total: number; passed: number; failed: number; pending: number };
  readonly gates!: { id: MergeGateId; state: MergeGateState }[];
  readonly reviewers!: PullRequestReviewer[];
  readonly viewerLogin!: string | null;
  /** The checks that failed on the head; empty when none did or they were not read. */
  readonly failingChecks: PullRequestFailingCheck[] = [];
  /** What the head's failing checks came to, one per check looked into. */
  readonly ciFindings: CiFinding[] = [];

  constructor(props: PullRequestDetailEntityProps) {
    super(props);
    // A subclass's fields are defined after `super` returns, so its own are set here.
    assignProps(this, props);
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }
}

export interface PullRequestFile {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  /** The unified diff; null for a binary file or one GitHub will not show. */
  patch: string | null;
}

export interface PullRequestComment {
  id: number;
  path: string;
  line: number | null;
  side: 'LEFT' | 'RIGHT';
  body: string;
  author: string;
  createdAt: Date;
}

/** What else happened on a pull request that its conversation shows. */
export type PullRequestActivityEvent =
  | 'review_requested'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'ready_for_review'
  | 'convert_to_draft'
  | 'head_ref_force_pushed';

/** One entry of a pull request's conversation, oldest first. */
export type PullRequestActivityItem = { id: string; author: string; at: Date } & (
  | { kind: 'comment'; body: string }
  | { kind: 'commit'; sha: string; message: string }
  | {
      kind: 'review';
      state: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
      body: string;
    }
  | { kind: 'event'; event: PullRequestActivityEvent; subject: string | null }
);

export interface LineCommentInput {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
}

export interface ReviewInput {
  verdict: ReviewVerdict;
  body?: string;
  comments: LineCommentInput[];
}

/** What submitting a review did to the merge. */
export interface ReviewOutcome {
  merged: boolean;
  /** GitHub merges it once its required checks pass. */
  autoMerge: boolean;
}

export interface WatchedRepository {
  installationId: string;
  githubRepoId: number;
  fullName: string;
  isPrivate: boolean;
  watching: boolean;
}

/** A figure this period and the one before. */
export interface AnalyticsFigure {
  value: number;
  previous: number;
}

/** A median in hours; null when nothing was measured. */
export interface AnalyticsMedian {
  value: number | null;
  previous: number | null;
}

export interface PullRequestAnalytics {
  range: PullRequestAnalyticsRange;
  /** False when more closed in the window than one read takes in full: the figures count the most recent. */
  complete: boolean;
  unreadable: UnreadableRepository[];
  /**
   * ISO 8601, not `Date`. These numbers are kept in the browser's storage, and
   * what comes back from JSON is a string: a `Date` here is a crash on the
   * first read after a reload, not a type error anywhere the compiler looks.
   */
  from: string;
  to: string;
  created: AnalyticsFigure;
  merged: AnalyticsFigure;
  reviewedByYou: AnalyticsFigure;
  waitForReview: AnalyticsMedian;
  waitForReviewAgents: AnalyticsMedian;
  waitForReviewPeople: AnalyticsMedian;
  timeToMerge: AnalyticsMedian;
  /** `YYYY-MM-DD`, oldest first: a day each, or the Monday of a week over a quarter. */
  days: { date: string; created: number; merged: number }[];
  /** What one entry of `days` covers. */
  bucket: 'day' | 'week';
  lanes: ({ lane: PullRequestLane } & AnalyticsFigure)[];
  waiting: { reason: PullRequestBlocker; value: number; medianHours: number | null }[];
}

/**
 * A review session: a session started from a pull request's Chat tab, in a
 * worktree of its head branch, listed under For review and never under
 * Sessions. The title and repository are as they were when it started.
 */
export interface ReviewSession {
  sessionId: string;
  installationId: string;
  githubRepoId: number;
  number: number;
  repository: string;
  title: string;
  headRef: string;
  hostId: string;
  state: string;
  createdAt: Date;
}

/** Whether a review session reviews the pull request at `address`. */
export function reviews(session: ReviewSession, address: PullRequestAddress): boolean {
  return (
    session.installationId === address.installationId &&
    session.githubRepoId === address.githubRepoId &&
    session.number === address.number
  );
}
