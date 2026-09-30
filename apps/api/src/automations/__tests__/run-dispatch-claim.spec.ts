import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The slot a run takes is reserved, not inferred from a count.
 *
 * The overlap and capacity guards weigh counts, and a count is only true until
 * something acts on it. The queue dispatches four runs at once: measured on a
 * real stack, ten manual runs of an automation whose overlap policy is `skip`
 * — one live run, by definition — started **four** sessions, one per worker,
 * because all four read the same counts before any had a session to be counted
 * by. With the reservation, the same burst starts one.
 *
 * The reservation is `claimedAt`, deliberately not another `outcome`: a run
 * that has claimed is still `pending`, so every client's view of the state
 * machine is unchanged and "dispatched implies a session" keeps holding. That
 * property is what the first version of this fix broke, and what the API's own
 * e2e caught.
 *
 * These pin the SQL, because the whole fix is which rows the guards count and
 * under what lock; a unit test of the entity would pass either way.
 */
const repository = readFileSync(
  fileURLToPath(new URL('../database/automation-run.repository.ts', import.meta.url)),
  'utf8',
);

describe('reserving an automation run’s slot', () => {
  it('counts a fresh claim towards the guards, while the run is still pending', () => {
    expect(repository).toContain(`run."outcome" = 'pending' AND run."claimedAt" >= $5`);
  });

  it('takes the host lock before it counts, so two dispatches cannot both pass', () => {
    const claim = repository.slice(repository.indexOf('async claimSlot'));
    const lock = claim.indexOf('lockHostDispatch');
    const count = claim.indexOf('SELECT\n           count(*)');
    expect(lock).toBeGreaterThan(-1);
    expect(count).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(count);
  });

  it('writes the claim only while the run is still pending', () => {
    // Two workers reaching the update means the second writes nothing and is
    // told so, rather than overwriting the winner's reservation.
    expect(repository).toContain(`WHERE "id" = $1 AND "outcome" = 'pending'`);
  });

  it('honours a claim only while it is fresh, so a dead process frees its slot', () => {
    const resolver = readFileSync(
      fileURLToPath(new URL('../application/run-dispatch.resolver.ts', import.meta.url)),
      'utf8',
    );
    expect(resolver).toContain('CLAIM_TTL_MS');
    expect(resolver).toContain('claimFloor: new Date(now.getTime() - CLAIM_TTL_MS)');
  });

  it('is namespaced per host, so other hosts dispatch in parallel', () => {
    expect(repository).toContain(`hashtext('automation-dispatch:' || $1::text)`);
  });
});
