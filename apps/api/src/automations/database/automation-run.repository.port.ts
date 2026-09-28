import type { AccessScope } from '@oppenheimer/backend-authz';
import type { AutomationRunStatus } from '@oppenheimer/shared/automations';
import type { Option } from 'oxide.ts';
import type {
  AutomationRunDigest,
  RunHistoryBucket,
  RunPage,
  RunReadModel,
} from '../domain/automation-read.types';
import type { AutomationRunEntity } from '../domain/automation-run.entity';

export interface RunFilters {
  automationId?: string;
  projectId?: string;
  statuses?: readonly AutomationRunStatus[];
  since: Date;
}

/** A live run, as the run-limit sweep needs it. */
export interface LiveRun {
  runId: string;
  organizationId: string;
  automationId: string;
  sessionId: string;
  dispatchedAt: Date;
}

export interface AutomationRunRepositoryPort {
  /**
   * Insert a firing unless its cause already fired this automation, and stage
   * its dispatch when it is pending — together. A duplicate cause inserts
   * nothing and answers with the run that cause already made, so a retried
   * request reads the same run.
   */
  insertFiring(run: AutomationRunEntity): Promise<{ runId: string; inserted: boolean }>;

  findOneForSystem(id: string): Promise<Option<AutomationRunEntity>>;

  /**
   * The sweep: re-stage the dispatch of runs still pending since before
   * `staleBefore` — their job ran out of retries, or Redis lost it — and move
   * their `availableAt` to now, so each is re-staged at most once per window.
   * The dispatcher's stale guard expires what is too old to still run.
   */
  restageStalled(staleBefore: Date, batch: number): Promise<number>;

  /** Write the outcome; a deferred run re-stages its dispatch for `availableAt`. */
  save(run: AutomationRunEntity): Promise<void>;

  /** Firings in the last hour, for the rate guards. Skipped ones do not count. */
  countRecent(
    organizationId: string,
    automationId: string,
    since: Date,
  ): Promise<{ automation: number; workspace: number }>;

  /**
   * Other runs of this automation that are still live — their session's
   * first turn not yet ended — among those dispatched since `since` (the run
   * limit: an older one is being stopped and holds no place).
   */
  countLiveForAutomation(
    automationId: string,
    excludingRunId: string,
    since: Date,
  ): Promise<number>;

  /** Live automation runs on a host, across workspaces: capacity is the machine's. */
  countLiveOnHost(hostId: string, excludingRunId: string, since: Date): Promise<number>;

  /**
   * Runs still live that were dispatched before `before`, oldest first: the
   * candidates the run-limit sweep weighs against each workspace's limit.
   */
  findLiveDispatchedBefore(before: Date, batch: number): Promise<LiveRun[]>;

  page(scope: AccessScope, filters: RunFilters, page: number, limit: number): Promise<RunPage>;

  history(
    scope: AccessScope,
    filters: Omit<RunFilters, 'statuses'>,
    timezone: string,
  ): Promise<RunHistoryBucket[]>;

  findOne(scope: AccessScope, id: string): Promise<Option<RunReadModel>>;

  /** For each automation: whether a run is live, how many ran since `since`, and the last six. */
  digests(
    scope: AccessScope,
    automationIds: readonly string[],
    since: Date,
  ): Promise<Map<string, AutomationRunDigest>>;

  deleteBefore(cutoff: Date, batch: number): Promise<number>;
}
