import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { STATUS_TABS, TRIGGER_SOURCES } from './list-filters';

/**
 * The Automations tab's facets, in the URL, like the Runs and Bot routines
 * tabs': a filtered list is a link someone can send, and a value the schema
 * does not accept reads as absent, which is the default.
 */
export const automationsSearchSchema = z.object({
  status: z.enum(STATUS_TABS).optional().catch(undefined),
  project: searchText,
  trigger: z.enum(TRIGGER_SOURCES).optional().catch(undefined),
});
export type AutomationsSearch = z.infer<typeof automationsSearchSchema>;
