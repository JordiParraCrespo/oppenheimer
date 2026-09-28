import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * New session's search. `project` is the sidebar's "New session here" and what
 * a new project lands with: the project chip starts on it and its defaults
 * prefill the rest. `host` is what Add a host lands with: the host chip starts
 * on the machine it paired.
 */
export const newSessionSearchSchema = z.object({ project: searchText, host: searchText });
