import type { CodingAgentId } from '@oppenheimer/shared/agents';
import type {
  AutomationOverlapPolicy,
  AutomationPausedReason,
  AutomationPermission,
  AutomationRunCause,
  AutomationRunOutcome,
  AutomationRunStatus,
  AutomationSkipReason,
  GithubEventType,
  RunWindow,
  ScheduleFrequency,
  TriggerFilter,
} from '@oppenheimer/shared/automations';
import type { TriggerInputDto } from '@oppenheimer/shared/schemas/automation';

/**
 * What an automation is doing, as its row and page header say it: listening,
 * paused (triggers ignored, Run now still works) or running (a run is live).
 */
export type AutomationStatus = 'active' | 'paused' | 'running';

/** A schedule trigger: a wall-clock rule in the zone it was set in. */
export interface ScheduleTrigger {
  source: 'schedule';
  id: string | null;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday, for `weekly`. */
  days?: number[];
  dayOfMonth?: number;
  /** `YYYY-MM-DD`, for `once`. */
  date?: string;
  timezone: string;
  nextFireAt: Date | null;
}

/** A GitHub trigger: an event on some of the automation's repositories, maybe narrowed. */
export interface GithubTrigger {
  source: 'github';
  id: string | null;
  event: GithubEventType;
  /** GitHub repository ids, as strings (the column is a bigint). */
  repositories: string[];
  filter: TriggerFilter;
}

export type AutomationTrigger = ScheduleTrigger | GithubTrigger;

/** A repository an automation's runs clone. */
export interface AutomationRepository {
  installationId: string;
  githubRepoId: string;
  fullName: string;
}

/** What a run executes: the part of an automation that makes a new revision when it changes. */
export interface AutomationRevision {
  id: string;
  number: number;
  hostId: string;
  agent: CodingAgentId;
  model: string | null;
  permission: AutomationPermission;
  effort: string | null;
  prompt: string;
  repositories: AutomationRepository[];
  createdAt: Date;
}

/** One of an automation's last runs, as the sidebar lists them under it. */
export interface AutomationRunSummary {
  id: string;
  title: string;
  status: AutomationRunStatus;
  /** The session it started, which is what opening the run shows. */
  sessionId: string | null;
  createdAt: Date;
}

/**
 * An automation (`product/versions/mvp/16-automations-architecture.md`): a
 * saved prompt that starts a session of its owner on a schedule, on a GitHub
 * event, or on Run now. The console lists and edits these; the runs they made
 * are {@link AutomationRunEntity}.
 */
export class AutomationEntity {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly name: string,
    public readonly ownedByMe: boolean,
    /** What the row says: running wins over paused while a run is live. */
    public readonly status: AutomationStatus,
    /** When it was paused: a fact of its own, since a paused automation can still have a live run. */
    public readonly pausedAt: Date | null,
    public readonly pausedReason: AutomationPausedReason | null,
    public readonly nextRunAt: Date | null,
    public readonly revision: AutomationRevision,
    public readonly triggers: AutomationTrigger[],
    public readonly overlap: AutomationOverlapPolicy | null,
    public readonly maxRunsPerHour: number | null,
    /** The optimistic-lock version an edit must name. */
    public readonly version: number,
    /** Runs in the last 30 days. */
    public readonly runCount: number,
    /** The last six, newest first. */
    public readonly lastRuns: AutomationRunSummary[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get isPaused(): boolean {
    return this.pausedAt !== null;
  }

  get isRunning(): boolean {
    return this.status === 'running';
  }

  /** The trigger the row's glyph and line describe: the first one. */
  get primaryTrigger(): AutomationTrigger | undefined {
    return this.triggers[0];
  }

  /** A schedule-only automation's glyph is a clock; anything with an event shows GitHub's mark. */
  get isScheduled(): boolean {
    return this.triggers.every((trigger) => trigger.source === 'schedule');
  }
}

/** Why a run started, in the words its row says it. */
export interface RunCause {
  label: string;
  text: string;
  ref?: string;
  actor?: string;
  url?: string;
  eventType: string;
}

/** The first turn of a run's session: its prompt, and how it ended. */
export interface RunTurn {
  state: string;
  exitCode: number | null;
  result: string | null;
  failureDetail: string | null;
  costUsd: number | null;
  permissionDenials: number;
  prompt: string | null;
}

/**
 * One firing of an automation. Its status is read from the session it
 * started — queued until the session exists, running while its first turn is,
 * then completed or failed as that turn ended — or it never started a session
 * (skipped, expired), and says why.
 */
export class AutomationRunEntity {
  constructor(
    public readonly id: string,
    public readonly automationId: string,
    public readonly automationName: string,
    public readonly automationDeleted: boolean,
    public readonly projectId: string,
    public readonly status: AutomationRunStatus,
    public readonly outcome: AutomationRunOutcome,
    public readonly skipReason: AutomationSkipReason | null,
    public readonly cause: AutomationRunCause,
    public readonly causeSummary: RunCause,
    public readonly title: string,
    public readonly sessionId: string | null,
    public readonly branch: string | null,
    public readonly revisionNumber: number,
    public readonly agent: string,
    public readonly model: string | null,
    public readonly hostId: string,
    public readonly createdAt: Date,
    public readonly startedAt: Date | null,
    public readonly endedAt: Date | null,
    public readonly durationMs: number | null,
    public readonly turn: RunTurn | null,
  ) {}

  get isLive(): boolean {
    return this.status === 'queued' || this.status === 'running';
  }
}

/** The counts on the Runs tab's status pills, under the same facets as the page. */
export interface RunStatusCounts {
  all: number;
  completed: number;
  failed: number;
  running: number;
}

export interface RunPage {
  items: AutomationRunEntity[];
  total: number;
  page: number;
  limit: number;
  counts: RunStatusCounts;
}

export interface RunsFilter {
  automationId?: string;
  projectId?: string;
  statuses?: readonly AutomationRunStatus[];
  window?: RunWindow;
  page?: number;
  limit?: number;
}

export interface RunHistoryDay {
  /** `YYYY-MM-DD`, a local day of the zone asked for. */
  date: string;
  succeeded: number;
  failed: number;
}

export interface RunHistory {
  days: RunHistoryDay[];
  succeeded: number;
  failed: number;
  total: number;
  timezone: string;
}

export interface RunHistoryFilter {
  automationId?: string;
  projectId?: string;
  days?: number;
  timezone: string;
}

/** One event a GitHub trigger would have matched, as the editor's preview lists it. */
export interface TriggerPreviewMatch {
  repository: string;
  ref?: string;
  title?: string;
  actor?: string;
  url?: string;
  occurredAt: Date;
}

export interface TriggerPreview {
  count: number;
  days: number;
  matches: TriggerPreviewMatch[];
}

/** A trigger as the editor saves it: no id, no computed next fire. */
/**
 * A trigger as the editor saves it: the shared schema's own input type, so
 * the console and the API validate one vocabulary.
 */
export type TriggerInput = TriggerInputDto;

export interface AutomationInput {
  projectId: string;
  repositories: { installationId: string; githubRepoId: number }[];
  hostId: string;
  name: string;
  triggers: TriggerInput[];
  prompt: string;
  agent: CodingAgentId;
  launch?: { model?: string; permission?: AutomationPermission };
}

export type UpdateAutomationInput = Partial<AutomationInput> & { version: number };
