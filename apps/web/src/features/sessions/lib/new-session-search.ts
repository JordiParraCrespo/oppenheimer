import { searchFlag, searchText } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { SESSION_PLACES } from '@oppenheimer/shared/schemas/session';
import { z } from 'zod';

/**
 * New session's search. `project` is the sidebar's "New session here" and what
 * a new project lands with: the project chip starts on it and its defaults
 * prefill the rest; with no project, the one the chip starts on prefills them
 * the same way (`product/versions/mvp/05-screens.md`). `host` is what Add a
 * host lands with: the host chip starts on the machine it paired.
 *
 * `where`, `path`, `agent` and `start` are Settings' **Open terminal**
 * (`product/versions/mvp/24-session-places.md` §3): a folder session (`where`)
 * in `path` (absolute, or `~` for the host's home) with the blank terminal
 * (`agent=shell`), started as soon as the folder is known (`start`).
 */
export const newSessionSearchSchema = z.object({
  project: searchText,
  host: searchText,
  where: z.enum(SESSION_PLACES).optional().catch(undefined),
  path: searchText,
  agent: z.enum(CODING_AGENT_IDS).optional().catch(undefined),
  start: searchFlag,
});
