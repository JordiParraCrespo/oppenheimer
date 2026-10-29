import { searchFlag, searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** The list's Type facet, in the frame's order; `all` is no key. */
export const INBOX_TYPES = ['all', 'pull', 'approval', 'session', 'run'] as const;
export type InboxTypeFilter = (typeof INBOX_TYPES)[number];

/** The Project facet's first option: every project. Not a search value: it is no key. */
export const ALL_PROJECTS = 'all';

/** The Project facet's value for an item no project holds. */
export const NO_PROJECT = 'none';

/**
 * `/plan/inbox`'s search: the item in the reading pane, the list's words
 * (`q`) and its facets, so a narrowed Inbox is a link. A value the schema does not accept reads as
 * absent, which is the default. Show done is on unless `hideDone` says not.
 */
export const inboxSearchSchema = z.object({
  item: searchText,
  q: searchText,
  type: z.enum(INBOX_TYPES).optional().catch(undefined),
  project: searchText,
  hideDone: searchFlag,
});
export type InboxSearch = z.infer<typeof inboxSearchSchema>;
