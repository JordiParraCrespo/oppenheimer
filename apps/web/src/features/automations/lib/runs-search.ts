import { searchPage, searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** The Runs tab's status pills, in the frames' order. */
export const RUN_STATUS_TABS = ['all', 'completed', 'failed', 'running'] as const;
export type RunStatusTab = (typeof RUN_STATUS_TABS)[number];

/**
 * The runs list's facets and page, in the URL: a filtered list is a link
 * someone can send, and Back undoes a filter. Declared on each route that
 * shows the list. `window` is checked against the run windows by the list
 * itself: the catalog is not worth a place on every route's first load.
 */
export const runsSearchSchema = z.object({
  status: z.enum(RUN_STATUS_TABS).optional().catch(undefined),
  automation: searchText,
  project: searchText,
  window: searchText,
  page: searchPage,
});
export type RunsSearch = z.infer<typeof runsSearchSchema>;
