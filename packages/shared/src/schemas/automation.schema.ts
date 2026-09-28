import { z } from 'zod';
import { SESSION_EFFORTS } from '../agents/catalog';
import {
  AUTOMATION_OVERLAP_POLICIES,
  AUTOMATION_PERMISSIONS,
  AUTOMATION_RUN_STATUSES,
  GITHUB_EVENT_TYPES,
  RUN_WINDOWS,
  SCHEDULE_FREQUENCIES,
  SCHEDULE_MAX_DAY_OF_MONTH,
} from '../automations/catalog';
import { isValidTimeZone } from '../automations/schedule';
import {
  codingAgentSchema,
  displayNameSchema,
  githubRepoIdSchema,
  gitRefSchema,
  installationIdSchema,
  promptSchema,
} from './primitives';

/**
 * Automation shapes (`product/versions/mvp/16-automations-architecture.md`).
 *
 * What the editor's three steps send — Task, Trigger, Where it runs — and the
 * queries the overview, the runs list, the history chart and the trigger
 * preview make. The constraints decidable from the body alone are here; whether
 * the project holds the repositories, whether the host is the owner's and
 * whether the agent can run unattended are the API's to answer.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** How many triggers one automation may hold. The editor draws each as a card. */
export const MAX_AUTOMATION_TRIGGERS = 10;
/** How many of the project's repositories an automation may work in. */
export const MAX_AUTOMATION_REPOSITORIES = 20;

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone);

const hourSchema = z.number().int().min(0).max(23);
const minuteSchema = z.number().int().min(0).max(59);
const weekdaySchema = z.number().int().min(0).max(6);
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A schedule card: the frequency and the fields that frequency reads. Fields a
 * frequency does not read are refused rather than ignored, so a stored rule
 * always says exactly what it does.
 */
export const scheduleTriggerInputSchema = z
  .object({
    source: z.literal('schedule'),
    frequency: z.enum(SCHEDULE_FREQUENCIES),
    hour: hourSchema,
    minute: minuteSchema,
    days: z.array(weekdaySchema).min(1).max(7).optional(),
    dayOfMonth: z.number().int().min(1).max(SCHEDULE_MAX_DAY_OF_MONTH).optional(),
    date: localDateSchema.optional(),
    timezone: timeZoneSchema,
  })
  .refine((value) => (value.frequency === 'weekly') === (value.days !== undefined), {
    path: ['days'],
  })
  .refine((value) => (value.frequency === 'monthly') === (value.dayOfMonth !== undefined), {
    path: ['dayOfMonth'],
  })
  .refine((value) => (value.frequency === 'once') === (value.date !== undefined), {
    path: ['date'],
  });

export type ScheduleTriggerInputDto = z.infer<typeof scheduleTriggerInputSchema>;

export const triggerFilterSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('any') }),
  z.object({ op: z.literal('equals'), value: gitRefSchema }),
]);

export type TriggerFilterDto = z.infer<typeof triggerFilterSchema>;

/**
 * A GitHub card: the event, the repositories it listens on (a subset of the
 * automation's), and one filter value or "any".
 */
export const githubTriggerInputSchema = z.object({
  source: z.literal('github'),
  event: z.enum(GITHUB_EVENT_TYPES),
  repositories: z.array(githubRepoIdSchema).min(1).max(MAX_AUTOMATION_REPOSITORIES),
  filter: triggerFilterSchema,
});

export type GithubTriggerInputDto = z.infer<typeof githubTriggerInputSchema>;

/**
 * One trigger. A union on `source`, so a new source is a new member rather than
 * a new field on every trigger — the same shape the catalog and the
 * `automation_trigger.config` column take.
 */
export const triggerInputSchema = z.union([scheduleTriggerInputSchema, githubTriggerInputSchema]);

export type TriggerInputDto = z.infer<typeof triggerInputSchema>;

/**
 * How each run's agent is started: the model, the permission level and the effort.
 * Permission is `auto` or `full` only — `ask` has nobody to ask — and `auto`
 * is the default, because a default that escalates is the one mistake this
 * field must not make.
 */
export const automationLaunchSchema = z.object({
  model: z.string().min(1).max(128).optional(),
  permission: z.enum(AUTOMATION_PERMISSIONS).default('auto'),
  effort: z.enum(SESSION_EFFORTS).optional(),
});

export type AutomationLaunchDto = z.infer<typeof automationLaunchSchema>;

/**
 * One repository an automation works in. The editor offers the project's
 * repositories first and then every other repository the workspace's
 * installations reach, so a repository is named the way a session's checkout
 * is — our installation row plus GitHub's id — rather than by project.
 */
export const automationRepositoryInputSchema = z.object({
  installationId: installationIdSchema,
  githubRepoId: githubRepoIdSchema,
});

export type AutomationRepositoryInputDto = z.infer<typeof automationRepositoryInputSchema>;

const repositoriesSchema = z
  .array(automationRepositoryInputSchema)
  .min(1)
  .max(MAX_AUTOMATION_REPOSITORIES)
  .refine((items) => new Set(items.map((item) => item.githubRepoId)).size === items.length);

const automationFields = z.object({
  /** Where it runs: the project it is listed under, its repositories and host. */
  projectId: z.string().uuid(),
  repositories: repositoriesSchema,
  hostId: z.string().uuid(),
  /** Task. */
  name: displayNameSchema,
  /** Trigger: any trigger starts a run. */
  triggers: z.array(triggerInputSchema).min(1).max(MAX_AUTOMATION_TRIGGERS),
  prompt: promptSchema,
  /**
   * Where it runs, continued: the agent and its model. Permission and effort are
   * not drawn by the frames; they default (`auto`, the agent's own effort) and
   * the API takes them for callers that set them.
   */
  agent: codingAgentSchema,
  launch: automationLaunchSchema.default({ permission: 'auto' }),
  /** Absent is active: an automation starts listening as soon as it is saved. */
  active: z.boolean().default(true),
  /** What a firing does while a run of this automation is still live. Null inherits the workspace's. */
  overlap: z.enum(AUTOMATION_OVERLAP_POLICIES).nullable().optional(),
  /** This automation's own hourly cap, under the workspace's. Null inherits. */
  maxRunsPerHour: z.number().int().min(1).max(1000).nullable().optional(),
});

/**
 * The editor's Task step: the two fields a person types. The rest of the
 * editor is picked, not typed, and the API checks it whole on save.
 */
export const automationTaskSchema = automationFields.pick({ name: true, prompt: true });

export type AutomationTaskDto = z.infer<typeof automationTaskSchema>;

/** Every GitHub trigger listens only on repositories the automation works in. */
function triggersWithinRepositories(value: {
  repositories?: AutomationRepositoryInputDto[];
  triggers?: TriggerInputDto[];
}): boolean {
  if (!value.repositories || !value.triggers) return true;
  const allowed = new Set(value.repositories.map((repository) => repository.githubRepoId));
  return value.triggers.every(
    (trigger) => trigger.source !== 'github' || trigger.repositories.every((id) => allowed.has(id)),
  );
}

/** `POST /automations` — Create automation. */
export const createAutomationSchema = automationFields.refine(triggersWithinRepositories, {
  path: ['triggers'],
});

export type CreateAutomationDto = z.infer<typeof createAutomationSchema>;

/**
 * `PATCH /automations/{id}` — Save. The editor sends what it edited; `version`
 * is the one it loaded, so a save over somebody else's (another tab's) is
 * refused rather than silently winning. `triggers`, when present, replaces the
 * set: the editor holds the whole list.
 */
export const updateAutomationSchema = automationFields
  .omit({ active: true })
  .partial()
  .extend({ version: z.number().int().min(1) })
  .refine(triggersWithinRepositories, { path: ['triggers'] });

export type UpdateAutomationDto = z.infer<typeof updateAutomationSchema>;

/** `GET /automations`. */
export const listAutomationsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export type ListAutomationsQueryDto = z.infer<typeof listAutomationsQuerySchema>;

const statusListSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
  z.array(z.enum(AUTOMATION_RUN_STATUSES)).min(1),
);

/**
 * `GET /automation-runs` — the Runs tab, and one automation's runs. Pages of
 * ten with a total, because the foot reads "1–10 of 65" with Previous and Next.
 */
export const listAutomationRunsQuerySchema = z.object({
  automationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: statusListSchema.optional(),
  window: z.enum(RUN_WINDOWS).default('30d'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListAutomationRunsQueryDto = z.infer<typeof listAutomationRunsQuerySchema>;

/**
 * `GET /automation-runs/history` — the run-history chart: one bar per local
 * day, so the day boundaries are the viewer's, which is why the zone travels.
 */
export const runHistoryQuerySchema = z.object({
  automationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
  timezone: timeZoneSchema.default('UTC'),
});

export type RunHistoryQueryDto = z.infer<typeof runHistoryQuerySchema>;

/**
 * `POST /automations/trigger-preview` — "Listening on xrp-mobile · would have
 * run 4 times in the last 7 days": a GitHub card replayed against what the
 * webhook actually received, before it is saved.
 */
export const triggerPreviewSchema = githubTriggerInputSchema.extend({
  days: z.number().int().min(1).max(30).default(7),
});

export type TriggerPreviewDto = z.infer<typeof triggerPreviewSchema>;

/**
 * `PATCH /automation-settings` — the workspace's level of the limits. Each
 * field optional; `null` clears it back to the platform default. The platform
 * ceilings still apply over whatever is set here.
 */
export const updateAutomationSettingsSchema = z.object({
  maxRunsPerAutomationHour: z.number().int().min(1).max(10_000).nullable().optional(),
  maxRunsPerWorkspaceHour: z.number().int().min(1).max(100_000).nullable().optional(),
  headlessRunsPerHost: z.number().int().min(1).max(100).nullable().optional(),
  overlap: z.enum(AUTOMATION_OVERLAP_POLICIES).nullable().optional(),
  staleTtlSeconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 3600)
    .nullable()
    .optional(),
  missedGraceSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .nullable()
    .optional(),
  maxRunSeconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 3600)
    .nullable()
    .optional(),
});

export type UpdateAutomationSettingsDto = z.infer<typeof updateAutomationSettingsSchema>;
