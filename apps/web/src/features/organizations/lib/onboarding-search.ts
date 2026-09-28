import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { walkParam } from './first-run';

/** Add host's search: the installation Connect GitHub wrote, so Ready can name it, and the walk. */
export const hostStepSearchSchema = z.object({ installation: searchText, walk: walkParam });

/** Ready's search: what the steps produced — absent for a skipped step — and the walk. */
export const readySearchSchema = z.object({
  installation: searchText,
  host: searchText,
  walk: walkParam,
});
