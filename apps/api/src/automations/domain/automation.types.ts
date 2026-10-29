import type { CreateSessionDto, Scope, StartCloudSessionDto } from '@oppenheimer/shared';
import type {
  AutomationOverlapPolicy,
  AutomationPausedReason,
  AutomationPermission,
  AutomationPlace,
  RunCheckoutRule,
  ScheduleRule,
  TriggerFilter,
  TriggerSource,
} from '@oppenheimer/shared/automations';

/**
 * What a run of an automation becomes once its guards let it through
 * (`26-bot-routines.md` §3): a session on a host, or a turn of a bot (a
 * routine), each carried out by its own `AutomationRunTarget`.
 */
export const AUTOMATION_RUN_TARGET_KINDS = ['session', 'bot'] as const;
export type AutomationRunTargetKind = (typeof AUTOMATION_RUN_TARGET_KINDS)[number];

/**
 * What a launched run became, as the run records it. A target that starts
 * something other than a session adds its arm here, beside the column the run
 * stores it in (`26-bot-routines.md` §3); the dispatcher passes it through
 * without reading it, so nothing that dispatches changes.
 */
export type RunDispatchRef =
  | { kind: 'session'; sessionId: string }
  | { kind: 'bot_turn'; turnId: string };

/**
 * The session a run starts, in the words of the command that starts it: one
 * a host runs or starts (`CreateSessionCommand`, Claude Code's cloud among
 * them), or one a vendor runs with no host (`StartCloudSessionCommand`).
 */
export type RunSessionLaunch =
  | { kind: 'host'; input: CreateSessionDto }
  | { kind: 'vendor'; input: StartCloudSessionDto };

/** One repository an automation works in, as the revision snapshots it. */
export interface AutomationRepository {
  /** Our installation row: what a session's checkout and its token mint name. */
  installationId: string;
  githubRepoId: string;
  /** A display snapshot of `owner/repo`, taken when the revision was saved. */
  fullName: string;
}

/** What every revision holds. Immutable once saved: a change is the next revision. */
interface RevisionCommon {
  id: string;
  number: number;
  prompt: string;
  createdByUserId: string | null;
  createdAt: Date;
}

/**
 * What a bot routine's run executes: its prompt. The bot's provider, model
 * and effort are read at the run, as an approval's turn reads them.
 */
export interface BotRevisionProps extends RevisionCommon {
  kind: 'bot';
}

/** What a session automation's run executes: the prompt and where and how it runs. */
export interface SessionRevisionProps extends RevisionCommon {
  kind: 'session';
  /** Where a run's session runs: on the host, in Claude Code's cloud from it, or at a vendor. */
  place: AutomationPlace;
  /** The host a run starts on or starts from; null only at a vendor, which needs none. */
  hostId: string | null;
  agent: string;
  model: string | null;
  permission: AutomationPermission;
  effort: string | null;
  repositories: AutomationRepository[];
}

export type AutomationRevisionProps = SessionRevisionProps | BotRevisionProps;

/**
 * What an automation's runs start, with what only that kind has
 * (`26-bot-routines.md` §3). Fixed for the automation's life: a session
 * automation is in a project and its revision says where and how a session
 * runs; a routine wakes its bot, within the scopes of the credential that
 * last saved what it runs. Callers narrow on `kind`, so the session-only
 * surface does not exist on a routine.
 */
export type AutomationTarget =
  | { kind: 'session'; projectId: string; revision: SessionRevisionProps }
  | {
      kind: 'bot';
      botId: string;
      /** Null for a browser session, which carries no scopes. */
      credentialScopes: readonly Scope[] | null;
      revision: BotRevisionProps;
    };

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

/** What one save of an automation changed; a save may make several. */
export type AutomationChange = 'created' | 'edited' | 'paused' | 'resumed' | 'deleted';

export type SessionTarget = Extract<AutomationTarget, { kind: 'session' }>;
export type BotTarget = Extract<AutomationTarget, { kind: 'bot' }>;
