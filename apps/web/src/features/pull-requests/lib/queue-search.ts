import { searchText } from '@oppenheimer/frontend-web';
import { PULL_REQUEST_LANES, PULL_REQUEST_SCOPES } from '@oppenheimer/shared/schemas/pull-request';
import { z } from 'zod';

/**
 * The queue's scope, lane and repository, in the URL: a filtered queue is a
 * link someone can send, and Back from a briefing returns to it. The search
 * box is the table's own and stays out of it.
 * A value the schema does not accept reads as absent, which is the default.
 */
export const queueSearchSchema = z.object({
  scope: z.enum(PULL_REQUEST_SCOPES).optional().catch(undefined),
  lane: z.enum(PULL_REQUEST_LANES).optional().catch(undefined),
  /** A repository's `owner/name`, picked in the sidebar. */
  repo: searchText,
});
export type QueueSearch = z.infer<typeof queueSearchSchema>;
