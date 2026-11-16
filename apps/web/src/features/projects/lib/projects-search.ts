import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** Projects' search: the words the cards are narrowed to, so a narrowed list is a link. */
export const projectsSearchSchema = z.object({ q: searchText });
export type ProjectsSearch = z.infer<typeof projectsSearchSchema>;
