import { searchText } from '@oppenheimer/frontend-web';
import {
  calendarDateSchema,
  TASK_ORIGINS,
  TASK_STATUSES,
  type TaskOrigin,
  type TaskStatus,
} from '@oppenheimer/shared/schemas/task';
import { z } from 'zod';
import { CALENDAR_VIEWS } from './calendar-view';

/** What the month draws, each one a toggle in the sidebar. */
export const CALENDAR_LAYERS = ['google', 'events', 'tasks', 'automations'] as const;
export type CalendarLayer = (typeof CALENDAR_LAYERS)[number];

/** A real calendar day, or nothing: `2026-99-99` is dropped rather than drawn. */
const isoDay = calendarDateSchema.optional().catch(undefined);

/**
 * The calendar's address: the view (`day`, `week` or `month`; Day when
 * absent), the day Day and Week are on (`YYYY-MM-DD`, today when absent),
 * the month the Month view shows (`YYYY-MM`, this month when absent), the
 * layers switched off (comma-separated, so the default — all on — is a bare
 * URL), the projects its tasks and automation runs are narrowed to (by slug,
 * comma-separated, as Plan's `?project=`), the task statuses shown
 * (comma-separated; every one when absent), whose tasks (`person` or `agent`;
 * anyone's when absent), the event whose dialog is open (`new` for New event), the day and
 * time (`HH:MM`) a New event starts on, and the Google event whose read-only
 * view is open.
 */
export const calendarSearchSchema = z.object({
  view: z.enum(CALENDAR_VIEWS).optional().catch(undefined),
  date: isoDay,
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  off: searchText,
  project: searchText,
  status: searchText,
  origin: z.enum(TASK_ORIGINS).optional().catch(undefined),
  event: searchText,
  google: searchText,
  day: isoDay,
  at: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .catch(undefined),
});
export type CalendarSearch = z.infer<typeof calendarSearchSchema>;

/** `?event=new`: the New event dialog. */
export const NEW_EVENT = 'new';

export function hiddenLayers(off: string | undefined): ReadonlySet<CalendarLayer> {
  const names = new Set((off ?? '').split(','));
  return new Set(CALENDAR_LAYERS.filter((layer) => names.has(layer)));
}

/** The `off` param with `layer` flipped; absent once every layer is on. */
export function toggleLayer(off: string | undefined, layer: CalendarLayer): string | undefined {
  const hidden = new Set(hiddenLayers(off));
  if (hidden.has(layer)) hidden.delete(layer);
  else hidden.add(layer);
  return hidden.size ? CALENDAR_LAYERS.filter((name) => hidden.has(name)).join(',') : undefined;
}

/** The layers on, for the Kind facet: none listed while every one is. */
export function shownLayers(off: string | undefined): CalendarLayer[] {
  const hidden = hiddenLayers(off);
  return hidden.size ? CALENDAR_LAYERS.filter((layer) => !hidden.has(layer)) : [];
}

/** The `off` param that shows only `shown`; absent when it is none or every layer. */
export function offParamOf(shown: readonly string[]): string | undefined {
  if (shown.length === 0) return undefined;
  const hidden = CALENDAR_LAYERS.filter((layer) => !shown.includes(layer));
  return hidden.length ? hidden.join(',') : undefined;
}

/** The statuses `?status=` lists, each once, in the board's order; none is every status. */
export function shownStatuses(param: string | undefined): TaskStatus[] {
  const names = new Set((param ?? '').split(','));
  return TASK_STATUSES.filter((status) => names.has(status));
}

/** `?status=` for the statuses picked; absent for none or every one. */
export function statusParamOf(picked: readonly string[]): string | undefined {
  const statuses = TASK_STATUSES.filter((status) => picked.includes(status));
  return statuses.length && statuses.length < TASK_STATUSES.length ? statuses.join(',') : undefined;
}

/**
 * What the filter row narrows the calendar's tasks and runs to: the projects
 * picked (absent for every one), the statuses shown (empty for every one) and
 * who added a task (absent for anyone). Events have none of these.
 */
export interface CalendarScope {
  projectIds?: readonly string[];
  statuses: readonly TaskStatus[];
  origin?: TaskOrigin;
}

/** The rows of the picked projects, every row while none is picked. */
export function inProjects<T extends { projectId: string | null }>(
  rows: readonly T[],
  projectIds: readonly string[] | undefined,
): readonly T[] {
  if (!projectIds) return rows;
  return rows.filter((row) => row.projectId !== null && projectIds.includes(row.projectId));
}

/** The tasks the scope keeps: of its projects, in its statuses, added by its origin. */
export function inScope<T extends { projectId: string; status: TaskStatus; origin: TaskOrigin }>(
  tasks: readonly T[],
  scope: CalendarScope,
): readonly T[] {
  return inProjects(tasks, scope.projectIds).filter(
    (task) =>
      (scope.statuses.length === 0 || scope.statuses.includes(task.status)) &&
      (!scope.origin || task.origin === scope.origin),
  );
}
