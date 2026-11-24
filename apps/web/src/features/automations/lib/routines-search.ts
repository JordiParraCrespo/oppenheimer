import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { STATUS_TABS, TRIGGER_SOURCES } from './list-filters';

/**
 * The Bot routines tab's facets, in the URL, like the Runs tab's: a filtered
 * list is a link someone can send, and a value the schema does not accept
 * reads as absent, which is the default.
 */
export const routinesSearchSchema = z.object({
  status: z.enum(STATUS_TABS).optional().catch(undefined),
  bot: searchText,
  trigger: z.enum(TRIGGER_SOURCES).optional().catch(undefined),
});
export type RoutinesSearch = z.infer<typeof routinesSearchSchema>;
