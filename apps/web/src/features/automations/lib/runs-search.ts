import { searchPage, searchText } from '@oppenheimer/frontend-web';
import type { RunWindow } from '@oppenheimer/shared/automations';
import { z } from 'zod';

/** The Runs tab's status pills, in the frames' order. */
export const RUN_STATUS_TABS = ['all', 'completed', 'failed', 'running'] as const;
export type RunStatusTab = (typeof RUN_STATUS_TABS)[number];

/**
 * The run windows, spelled here because the schema runs on every route's first
 * load and the automations catalog is not worth a place there. The typecheck
 * holds the two lists together: `satisfies` refuses a window the catalog does
 * not have, and the list writes a `RunWindow` into this search, which refuses
 * one this list does not have.
 */
const RUN_WINDOW_PARAMS = ['24h', '7d', '30d'] as const satisfies readonly RunWindow[];

/**
 * The runs list's facets and page, in the URL: a filtered list is a link
 * someone can send, and Back undoes a filter. Declared on each route that
 * shows the list, and the only reading of it: a value it does not accept
 * reads as absent, which is the default.
 */
export const runsSearchSchema = z.object({
  status: z.enum(RUN_STATUS_TABS).optional().catch(undefined),
  automation: searchText,
  project: searchText,
  window: z.enum(RUN_WINDOW_PARAMS).optional().catch(undefined),
  page: searchPage,
});
export type RunsSearch = z.infer<typeof runsSearchSchema>;
