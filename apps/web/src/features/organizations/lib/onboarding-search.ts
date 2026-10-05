import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';
import { walkFromState, walkParam } from './first-run';

/** Add host's search: the installation Connect GitHub wrote, so Ready can name it, and the walk. */
export const hostStepSearchSchema = z.object({ installation: searchText, walk: walkParam });

/** Ready's search: what the steps produced — absent for a skipped step — and the walk. */
export const readySearchSchema = z.object({
  installation: searchText,
  host: searchText,
  walk: walkParam,
});

/** The API's nonce: base64url, 16–128 characters, so never a `.`. */
const STATE_NONCE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * What GitHub appends to the callback once someone has installed the App.
 *
 * - `installation_id` is text in the URL and parsed here: a `NaN` reaching the
 *   API would be a 400 the screen could not explain.
 * - `code` is the one-shot OAuth code proving the caller can see it.
 * - `state` is the install state, **nonce only**: the walk's prefix is
 *   stripped first (`githubStepSearchSchema`), so the connect call posts
 *   exactly what was minted. Anything else reads as absent, and the step
 *   refuses to post rather than letting the API say so.
 */
export const githubCallbackSearchSchema = z.object({
  installation_id: z.coerce.number().int().positive().optional().catch(undefined),
  code: searchText,
  setup_action: searchText,
  state: z.string().regex(STATE_NONCE).optional().catch(undefined),
});

/**
 * Connect GitHub's search: GitHub's callback and the walk. The walk rides as
 * the prefix of `state`, the one value GitHub echoes, so it is read off there
 * before the callback's own keys are parsed.
 */
export const githubStepSearchSchema = z.preprocess(
  walkFromState,
  githubCallbackSearchSchema.extend({ walk: walkParam }),
);
