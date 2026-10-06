import type {
  MergeMethod,
  PullRequestAnalyticsRange,
  PullRequestLane,
  PullRequestScope,
  ReviewVerdict,
} from '@oppenheimer/shared/schemas/pull-request';

export type {
  MergeMethod,
  PullRequestAnalyticsRange,
  PullRequestLane,
  PullRequestScope,
  ReviewVerdict,
};

/**
 * A pull request is GitHub's: the console names one by the installation that
 * reaches it, the repository and its number, and keeps nothing of it
 * (`product/next-steps/0.2-pull-requests-api-plan.md`).
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

/** What GitHub did not give on a read: which repository, what of it, and the refusal it gave. */
export interface UnreadableRepository {
  fullName: string;
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

/** One row of the queue. */
export class PullRequestEntity {
  constructor(
    public readonly installationId: string,
    public readonly githubRepoId: number,
    /** `acme-labs/xrp-mobile`. */
    public readonly repository: string,
    public readonly number: number,
    public readonly title: string,
    /** A GitHub login. */
    public readonly author: string,
    /** A session's when its branch is one a session pushed. */
    public readonly authorKind: 'session' | 'person',
    public readonly headRef: string,
    public readonly scope: PullRequestScope,
    public readonly lane: PullRequestLane,
    public readonly laneReason: LaneReason,
    public readonly additions: number,
    public readonly deletions: number,
    public readonly checks: PullRequestChecks,
    public readonly mergeable: boolean,
    public readonly blocker: PullRequestBlocker | null,
    public readonly waitingSeconds: number,
    public readonly draft: boolean,
    public readonly htmlUrl: string,
    /** Why the checks are `unavailable`; null when GitHub showed them. */
    public readonly checksRefusal: ReadRefusal | null,
    /** What GitHub did not give on this read; an unread part is not an empty one. */
    public readonly unread: readonly ('files' | 'reviews')[],
  ) {}

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
  scopes: Record<PullRequestScope, number>;
  /** Within the scope asked for. */
  lanes: Record<PullRequestLane, number>;
  readyToMerge: number;
  withConflicts: number;
  oldestWaitingSeconds: number | null;
  /** Null until the caller connects GitHub: nothing is done in their name before. */
  viewerLogin: string | null;
}

export type MergeGateId = 'checks' | 'conflicts' | 'review' | 'merge';
export type MergeGateState = 'done' | 'failed' | 'pending';

export interface PullRequestReviewer {
  login: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'requested';
}

/** The briefing: the row, and what the page around it reads. */
export class PullRequestDetailEntity extends PullRequestEntity {
  constructor(
    row: PullRequestEntity,
    /** The description, as written (Markdown). */
    public readonly body: string,
    public readonly baseRef: string,
    public readonly state: 'open' | 'merged' | 'closed',
    public readonly changedFiles: number,
    /** Top-level directories, most files first. */
    public readonly folders: string[],
    public readonly checkCounts: { total: number; passed: number; failed: number; pending: number },
    public readonly gates: { id: MergeGateId; state: MergeGateState }[],
    public readonly reviewers: PullRequestReviewer[],
    public readonly viewerLogin: string | null,
  ) {
    super(
      row.installationId,
      row.githubRepoId,
      row.repository,
      row.number,
      row.title,
      row.author,
      row.authorKind,
      row.headRef,
      row.scope,
      row.lane,
      row.laneReason,
      row.additions,
      row.deletions,
      row.checks,
      row.mergeable,
      row.blocker,
      row.waitingSeconds,
      row.draft,
      row.htmlUrl,
      row.checksRefusal,
      row.unread,
    );
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
  from: Date;
  to: Date;
  created: AnalyticsFigure;
  merged: AnalyticsFigure;
  reviewedByYou: AnalyticsFigure;
  waitForReview: AnalyticsMedian;
  waitForReviewAgents: AnalyticsMedian;
  waitForReviewPeople: AnalyticsMedian;
  timeToMerge: AnalyticsMedian;
  /** `YYYY-MM-DD`, oldest first. */
  days: { date: string; created: number; merged: number }[];
  lanes: ({ lane: PullRequestLane } & AnalyticsFigure)[];
  waiting: { reason: PullRequestBlocker; value: number; medianHours: number | null }[];
}
