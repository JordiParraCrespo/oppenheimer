import type {
  AutomationRunCause,
  AutomationRunOutcome,
  AutomationRunStatus,
  AutomationSkipReason,
} from '@oppenheimer/shared/automations';
import type { StoredExternalEvent } from '../../inbound-events/domain/external-event.types';
import type { AutomationEntity } from './automation.entity';
import type { RunCauseSummary } from './automation-run.entity';

/**
 * A run as the lists read it: the firing joined to its automation, its
 * revision, and — once dispatched — its session and that session's first
 * turn, where execution lives (§Q4). Status is derived once, in the repository's SQL.
 */
export interface RunReadModel {
  id: string;
  automationId: string;
  automationName: string;
  automationDeleted: boolean;
  projectId: string;
  status: AutomationRunStatus;
  outcome: AutomationRunOutcome;
  skipReason: AutomationSkipReason | null;
  cause: AutomationRunCause;
  causeSummary: RunCauseSummary;
  sessionId: string | null;
  sessionName: string | null;
  sessionNamed: boolean;
  branch: string | null;
  revisionNumber: number;
  agent: string;
  model: string | null;
  hostId: string;
  createdAt: Date;
  scheduledFor: Date | null;
  dispatchedAt: Date | null;
  turn: {
    state: string;
    startedAt: Date | null;
    endedAt: Date | null;
    exitCode: number | null;
    result: string | null;
    failureDetail: string | null;
    costUsd: number | null;
    permissionDenials: number;
    prompt: string | null;
  } | null;
}

export interface RunPage {
  items: RunReadModel[];
  total: number;
  counts: { all: number; completed: number; failed: number; running: number };
}

export interface RunHistoryBucket {
  /** `YYYY-MM-DD` in the zone asked for. */
  date: string;
  succeeded: number;
  failed: number;
}

/** The sidebar and table columns that come from runs, per automation. */
export interface AutomationRunDigest {
  running: boolean;
  runCount: number;
  lastRuns: RunReadModel[];
}

/** The sidebar and the table: every live automation and what its runs say. */
export interface AutomationListing {
  automations: AutomationEntity[];
  digests: Map<string, AutomationRunDigest>;
}

export interface AutomationDetail {
  automation: AutomationEntity;
  digest: AutomationRunDigest | undefined;
}

/** The history chart: every local day of the window, oldest first. */
export interface RunHistory {
  days: RunHistoryBucket[];
  timezone: string;
}

/** A GitHub card replayed against what the webhook received. */
export interface TriggerPreview {
  count: number;
  days: number;
  matches: StoredExternalEvent[];
}
