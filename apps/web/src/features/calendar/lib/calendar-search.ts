import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** What the month draws, each one a toggle in the sidebar (`20-plan-calendar.md` §1). */
export const CALENDAR_LAYERS = ['events', 'google', 'tasks', 'automations'] as const;
export type CalendarLayer = (typeof CALENDAR_LAYERS)[number];

/**
 * The calendar's address: the month (`YYYY-MM`, this month when absent), the
 * layers switched off (comma-separated, so the default — all on — is a bare
 * URL), the event whose dialog is open (`new` for New event) and the day a
 * New event starts on.
 */
export const calendarSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  off: searchText,
  event: searchText,
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
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
