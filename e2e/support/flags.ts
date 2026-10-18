import { type APIRequestContext, expect } from '@playwright/test';
import { query } from './db';

/**
 * Turns a boolean flag on for everyone on this stack and waits until `api`
 * is served it: every replica picks the row up on its next snapshot poll.
 *
 * It is left on. Specs that need a release flag call this in parallel, and
 * putting it back from one would turn it off under another; nothing in the
 * suite depends on a release flag being off. A spec that does (the netsim
 * bench) keeps its own copy, with the restore.
 */
export async function turnOnForEveryone(api: APIRequestContext, key: string): Promise<void> {
  await query(
    `INSERT INTO feature_flag (id, key, enabled, rules, fallthrough, salt)
     VALUES (gen_random_uuid(), $1, true, '[]', '{"value": true}', 'e2e')
     ON CONFLICT (key) DO UPDATE SET enabled = true, rules = '[]', fallthrough = '{"value": true}'`,
    [key],
  );
  await expect
    .poll(
      async () => {
        const response = await api.get('/api/v1/feature-flags');
        return (await response.text()).includes(`"${key}":true`);
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe(true);
}
