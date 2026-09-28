/**
 * The trigger catalog: every event an automation can start on, as data.
 *
 * This file is the single place a trigger exists
 * (`product/versions/mvp/16-automations-architecture.md` §Q6, §Q9, §Q13). The
 * API validates a trigger's config against it, the matcher reads its filter
 * field, the dispatcher reads its checkout rule, and the console builds the
 * editor's trigger menu from it. Adding an event — or a whole source, such as
 * Slack — is rows here plus the source's adapter in the API, with no migration
 * and no new UI.
 *
 * Labels are the English copy the frames draw. The console translates them by
 * key (`automations.events.<type>`); the labels here are what the API's docs and
 * error details print.
 */

/**
 * Where a trigger comes from. `schedule` is ours; every other source is an
 * external system that delivers events through the inbound-events hub.
 */
export const TRIGGER_SOURCES = ['schedule', 'github'] as const;
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

/** The sources whose events arrive from outside, through a webhook. */
export const EXTERNAL_TRIGGER_SOURCES = ['github'] as const satisfies readonly TriggerSource[];
export type ExternalTriggerSource = (typeof EXTERNAL_TRIGGER_SOURCES)[number];

export function isExternalTriggerSource(value: unknown): value is ExternalTriggerSource {
  return (EXTERNAL_TRIGGER_SOURCES as readonly unknown[]).includes(value);
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

/** The six frequencies the editor offers, in the frames' order. */
export const SCHEDULE_FREQUENCIES = [
  'once',
  'hourly',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export interface ScheduleFrequencyDefinition {
  readonly frequency: ScheduleFrequency;
  readonly label: string;
  readonly description: string;
}

export const SCHEDULE_FREQUENCY_CATALOG: readonly ScheduleFrequencyDefinition[] = [
  { frequency: 'once', label: 'Once', description: 'On a chosen date and time' },
  { frequency: 'hourly', label: 'Hourly', description: 'Every hour, at a chosen minute' },
  { frequency: 'daily', label: 'Daily', description: 'Every day at a chosen time' },
  { frequency: 'weekdays', label: 'Weekdays', description: 'Monday to Friday at a chosen time' },
  { frequency: 'weekly', label: 'Weekly', description: 'On the days you pick' },
  { frequency: 'monthly', label: 'Monthly', description: 'On one day of the month' },
];

/**
 * The last day of the month a monthly schedule may name. 28, because every
 * month has one: "the 31st" would silently skip seven months a year.
 */
export const SCHEDULE_MAX_DAY_OF_MONTH = 28;

// ---------------------------------------------------------------------------
// External events
// ---------------------------------------------------------------------------

/**
 * The eleven GitHub events the frames offer. The ids are the frames' own, and
 * they are also the canonical `ExternalEvent.type` the GitHub adapter
 * normalizes a delivery to — one vocabulary from the webhook to the editor.
 */
export const GITHUB_EVENT_TYPES = [
  'pr_opened',
  'pr_draft',
  'pr_sync',
  'pr_merged',
  'comment',
  'push',
  'issue_labeled',
  'check_failed',
  'issue_opened',
  'mention',
  'release',
] as const;
export type GithubEventType = (typeof GITHUB_EVENT_TYPES)[number];

/** Every external event type any source defines. */
export type ExternalEventType = GithubEventType;

/**
 * The attribute a trigger's one filter value is compared with. `null` is an
 * event with nothing to narrow on (an issue opened, a release), whose trigger
 * always matches.
 */
export const TRIGGER_FILTER_FIELDS = ['baseBranch', 'branch', 'label'] as const;
export type TriggerFilterField = (typeof TRIGGER_FILTER_FIELDS)[number];

/**
 * How a filter compares. The frames offer one value or "any"; note 05's
 * `contains`, `one_of` and `regex` are operators to add here, not a change to
 * any stored shape.
 */
export const TRIGGER_FILTER_OPS = ['any', 'equals'] as const;
export type TriggerFilterOp = (typeof TRIGGER_FILTER_OPS)[number];

/**
 * Where a run's worktree starts, decided by what fired it (§Q13). The prompt can
 * still send the agent elsewhere with git.
 */
export const RUN_CHECKOUT_RULES = [
  /** A fresh worktree on the repository's default branch. */
  'default_branch',
  /** The pull request's head branch. */
  'pull_request_head',
  /** The branch that was pushed. */
  'pushed_branch',
] as const;
export type RunCheckoutRule = (typeof RUN_CHECKOUT_RULES)[number];

export interface ExternalEventDefinition {
  readonly source: ExternalTriggerSource;
  readonly type: ExternalEventType;
  readonly label: string;
  readonly description: string;
  /** The attribute the trigger's filter narrows on, or `null` for none. */
  readonly filterField: TriggerFilterField | null;
  /** The filter a new trigger of this event starts with. */
  readonly defaultFilter: TriggerFilter;
  readonly checkout: RunCheckoutRule;
  /**
   * Whether the event carries text written by people who may be outside the
   * workspace — an issue body, a comment, a fork's pull request. Such a trigger
   * caps the automation's permission at `auto` unless the owner confirms `full`
   * (§Q11): untrusted text steering an agent with no guardrails on somebody's
   * own machine is the case that permission exists for.
   */
  readonly untrustedContent: boolean;
}

export type TriggerFilter = { op: 'any' } | { op: 'equals'; value: string };

export const ANY_FILTER: TriggerFilter = Object.freeze({ op: 'any' as const });

export const EXTERNAL_EVENT_CATALOG: readonly ExternalEventDefinition[] = [
  {
    source: 'github',
    type: 'pr_opened',
    label: 'Pull request opened',
    description: 'Opened, or a draft marked ready for review',
    filterField: 'baseBranch',
    defaultFilter: { op: 'equals', value: 'main' },
    checkout: 'pull_request_head',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'pr_draft',
    label: 'Draft opened',
    description: 'Opened as a draft, or converted to one',
    filterField: 'baseBranch',
    defaultFilter: { op: 'equals', value: 'main' },
    checkout: 'pull_request_head',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'pr_sync',
    label: 'Pull request pushed',
    description: 'New commits pushed to an open pull request',
    filterField: 'baseBranch',
    defaultFilter: { op: 'equals', value: 'main' },
    checkout: 'pull_request_head',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'pr_merged',
    label: 'Pull request merged',
    description: 'After the merge lands',
    filterField: 'baseBranch',
    defaultFilter: { op: 'equals', value: 'main' },
    checkout: 'pull_request_head',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'comment',
    label: 'Comment added',
    description: 'On a pull request or issue',
    filterField: null,
    defaultFilter: ANY_FILTER,
    checkout: 'default_branch',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'push',
    label: 'Push to branch',
    description: 'One run per push, not per commit',
    filterField: 'branch',
    defaultFilter: ANY_FILTER,
    checkout: 'pushed_branch',
    untrustedContent: false,
  },
  {
    source: 'github',
    type: 'issue_labeled',
    label: 'Label added',
    description: 'On a pull request or issue, once per label',
    filterField: 'label',
    defaultFilter: { op: 'equals', value: 'bug' },
    checkout: 'default_branch',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'check_failed',
    label: 'Check failed',
    description: 'Any Actions workflow or status check',
    filterField: 'branch',
    defaultFilter: ANY_FILTER,
    checkout: 'pull_request_head',
    untrustedContent: false,
  },
  {
    source: 'github',
    type: 'issue_opened',
    label: 'Issue opened',
    description: 'New issues only, not reopened ones',
    filterField: null,
    defaultFilter: ANY_FILTER,
    checkout: 'default_branch',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'mention',
    label: 'Mentioned @oppenheimer',
    description: 'In an issue, pull request or review',
    filterField: null,
    defaultFilter: ANY_FILTER,
    checkout: 'default_branch',
    untrustedContent: true,
  },
  {
    source: 'github',
    type: 'release',
    label: 'Release published',
    description: 'Pre-releases excluded',
    filterField: null,
    defaultFilter: ANY_FILTER,
    checkout: 'default_branch',
    untrustedContent: false,
  },
];

const BY_TYPE: ReadonlyMap<string, ExternalEventDefinition> = new Map(
  EXTERNAL_EVENT_CATALOG.map((definition) => [
    `${definition.source}:${definition.type}`,
    definition,
  ]),
);

/** The catalog row for `(source, type)`, or `undefined` for one no build defines. */
export function externalEventDefinition(
  source: string,
  type: string,
): ExternalEventDefinition | undefined {
  return BY_TYPE.get(`${source}:${type}`);
}

/** The event types a source defines, in catalog order. */
export function externalEventTypesOf(source: ExternalTriggerSource): readonly ExternalEventType[] {
  return EXTERNAL_EVENT_CATALOG.filter((definition) => definition.source === source).map(
    (definition) => definition.type,
  );
}

/**
 * Whether an event's attributes satisfy a trigger's filter.
 *
 * Pure and shared, so the matcher in the API and the editor's "would have run N
 * times in the last 7 days" preview agree by construction. An event with no
 * filter field matches whatever the trigger stored; a missing attribute never
 * matches `equals`, because "no base branch" is not "main".
 */
export function matchesTriggerFilter(
  definition: Pick<ExternalEventDefinition, 'filterField'>,
  filter: TriggerFilter,
  attributes: Readonly<Record<string, unknown>>,
): boolean {
  if (definition.filterField === null || filter.op === 'any') return true;
  const actual = attributes[definition.filterField];
  if (Array.isArray(actual)) return actual.includes(filter.value);
  return actual === filter.value;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/**
 * What became of a firing before any session existed (§Q4). Once a run is
 * `dispatched`, how it went is the session's turn to say, never this row's.
 */
export const AUTOMATION_RUN_OUTCOMES = ['pending', 'skipped', 'expired', 'dispatched'] as const;
export type AutomationRunOutcome = (typeof AUTOMATION_RUN_OUTCOMES)[number];

/** Why a firing did not become a session. Each is a guard's name for its refusal. */
export const AUTOMATION_SKIP_REASONS = [
  /** The automation is paused; only Run now passes. */
  'paused',
  /** The automation was deleted between the firing and the dispatch. */
  'deleted',
  /** An event our own App caused (a run's push, its comment). */
  'own_event',
  /** The per-automation hourly cap. */
  'automation_rate_limited',
  /** The per-workspace hourly cap. */
  'workspace_rate_limited',
  /** Another run of the same automation is still live, and overlap is `skip`. */
  'overlapping',
  /** A schedule slot older than the missed-slot grace. */
  'missed',
  /** The owner can no longer start the session: host, project, membership. */
  'not_launchable',
  /** The host cannot run the agent (never probed, or no headless mode). */
  'agent_unavailable',
] as const;
export type AutomationSkipReason = (typeof AUTOMATION_SKIP_REASONS)[number];

/** What started a run. */
export const AUTOMATION_RUN_CAUSES = ['schedule', 'event', 'manual'] as const;
export type AutomationRunCause = (typeof AUTOMATION_RUN_CAUSES)[number];

/** Why an automation is paused. `user` is the only one a person resumes without fixing anything. */
export const AUTOMATION_PAUSED_REASONS = [
  'user',
  'project_archived',
  'host_unpaired',
  'owner_lost_access',
] as const;
export type AutomationPausedReason = (typeof AUTOMATION_PAUSED_REASONS)[number];

/** The permission levels an unattended run may take (§Q11). `ask` has nobody to ask. */
export const AUTOMATION_PERMISSIONS = ['auto', 'full'] as const;
export type AutomationPermission = (typeof AUTOMATION_PERMISSIONS)[number];

/** What a run does when the previous run of the same automation is still live. */
export const AUTOMATION_OVERLAP_POLICIES = ['skip', 'queue'] as const;
export type AutomationOverlapPolicy = (typeof AUTOMATION_OVERLAP_POLICIES)[number];

/**
 * What a run reads as, anywhere it is listed: one word derived on read from the
 * firing's outcome and, once dispatched, the session's turn (§Q4). The console
 * draws `running`, `completed` and `failed`; the rest are the states the frames
 * do not draw yet and the API still reports honestly.
 */
export const AUTOMATION_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'skipped',
  'expired',
] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

/** The statuses the runs list shows unless asked otherwise: the ones that became sessions. */
export const LISTED_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly AutomationRunStatus[];

/** The windows the runs list and the history chart offer, in the frames' words. */
export const RUN_WINDOWS = ['24h', '7d', '30d'] as const;
export type RunWindow = (typeof RUN_WINDOWS)[number];

export const RUN_WINDOW_DAYS: Readonly<Record<RunWindow, number>> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

/** How far back the history chart and the editor's GitHub preview look. */
export const RUN_HISTORY_DAYS = 30;
export const TRIGGER_PREVIEW_DAYS = 7;
