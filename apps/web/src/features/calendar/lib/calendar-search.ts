import { searchText } from '@oppenheimer/frontend-web';
import { calendarDateSchema } from '@oppenheimer/shared/schemas/task';
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
 * comma-separated, as Plan's `?project=`), the event whose dialog is open (`new` for New event), the day and
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

/** `?project=unassigned` names the workspace's Unassigned project, as on Plan's board. */
export const UNASSIGNED_SLUG = 'unassigned';

/** The slugs `?project=` lists, each once, in the order they were picked. */
export function projectSlugsOf(param: string | undefined): string[] {
  return [
    ...new Set(
      (param ?? '')
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ];
}

/** `?project=` for a set of slugs; none is no key, so the calendar shows every project. */
export function projectParamOf(slugs: readonly string[]): string | undefined {
  return slugs.length ? slugs.join(',') : undefined;
}

/**
 * The ids of the projects a set of slugs names, `undefined` for none (every
 * project). A slug no project has names nothing, so a stale link narrows to
 * an empty set rather than widening to every project.
 */
export function projectIdsOfSlugs(
  slugs: readonly string[],
  projects: readonly { id: string; slug: string; isUnassigned: boolean }[],
): string[] | undefined {
  if (slugs.length === 0) return undefined;
  return projects
    .filter((row) => slugs.includes(row.isUnassigned ? UNASSIGNED_SLUG : row.slug))
    .map((row) => row.id);
}

/** The rows of the picked projects, every row while none is picked. */
export function inProjects<T extends { projectId: string | null }>(
  rows: readonly T[],
  projectIds: readonly string[] | undefined,
): readonly T[] {
  if (!projectIds) return rows;
  return rows.filter((row) => row.projectId !== null && projectIds.includes(row.projectId));
}
