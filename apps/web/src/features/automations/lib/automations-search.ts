import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { listSearchFields } from './list-filters';

/**
 * The Automations tab's facets, in the URL like the Runs tab's: a filtered
 * list is a link someone can send. The project is the list's owner facet.
 */
export const automationsSearchSchema = z.object({
  ...listSearchFields,
  project: searchText,
});
