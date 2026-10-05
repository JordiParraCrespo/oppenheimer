import type {
  AutomationOverlapPolicy,
  AutomationPausedReason,
  AutomationPermission,
  RunCheckoutRule,
  ScheduleRule,
  TriggerFilter,
  TriggerSource,
} from '@oppenheimer/shared/automations';

/** One repository an automation works in, as the revision snapshots it. */
export interface AutomationRepository {
  /** Our installation row: what a session's checkout and its token mint name. */
  installationId: string;
  githubRepoId: string;
  /** A display snapshot of `owner/repo`, taken when the revision was saved. */
  fullName: string;
}

/** What a run executes. Immutable once saved: a change is the next revision. */
export interface AutomationRevisionProps {
  id: string;
  number: number;
  hostId: string;
  agent: string;
  model: string | null;
  permission: AutomationPermission;
  effort: string | null;
  prompt: string;
  repositories: AutomationRepository[];
  createdByUserId: string | null;
  createdAt: Date;
}

/** A schedule trigger's config: the rule without its zone, which is a column. */
export type ScheduleTriggerConfig = Omit<ScheduleRule, 'timezone'>;

/** A GitHub trigger's config: which repositories it listens on, and its filter. */
export interface GithubTriggerConfig {
  repositories: string[];
  filter: TriggerFilter;
}

export type AutomationTriggerProps =
  | {
      id: string;
      position: number;
      source: 'schedule';
      eventType: 'schedule';
      config: ScheduleTriggerConfig;
      timezone: string;
      nextFireAt: Date | null;
    }
  | {
      id: string;
      position: number;
      source: Exclude<TriggerSource, 'schedule'>;
      eventType: string;
      config: GithubTriggerConfig;
      timezone: null;
      nextFireAt: null;
    };

export interface AutomationLimits {
  overlap: AutomationOverlapPolicy | null;
  maxRunsPerHour: number | null;
}

export type { AutomationPausedReason, RunCheckoutRule };
