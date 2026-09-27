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

export interface AutomationRunRepositoryPort {
  /**
   * Insert a firing unless its cause already fired this automation, and stage
   * its dispatch when it is pending — together. A duplicate cause inserts
   * nothing and answers with the run that cause already made, so a retried
   * request reads the same run.
   */
  insertFiring(run: AutomationRunEntity): Promise<{ runId: string; inserted: boolean }>;

  findOneForSystem(id: string): Promise<Option<AutomationRunEntity>>;

  /** Write the outcome; a deferred run re-stages its dispatch for `availableAt`. */
  save(run: AutomationRunEntity): Promise<void>;

  /** Firings in the last hour, for the rate guards. Skipped ones do not count. */
  countRecent(
    organizationId: string,
    automationId: string,
    since: Date,
  ): Promise<{ automation: number; workspace: number }>;

  /** Other runs of this automation that are still live. */
  countLiveForAutomation(automationId: string, excludingRunId: string): Promise<number>;

  /** Live automation runs on a host, across workspaces: capacity is the machine's. */
  countLiveOnHost(hostId: string, excludingRunId: string): Promise<number>;

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
