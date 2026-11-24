import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { listSearchFields } from './list-filters';

/**
 * The Bot routines tab's facets, in the URL like the Runs tab's: a filtered
 * list is a link someone can send. The bot is the list's owner facet.
 */
export const routinesSearchSchema = z.object({
  ...listSearchFields,
  bot: searchText,
});
