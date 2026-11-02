import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import { inject } from 'vitest';
import { claimRedisDb, releaseRedisDbs } from './integration-servers';

/**
 * The claim of a logical Redis db, against the run's real Redis: two runs
 * sharing one server (two `ci:local`s on the stack's Redis) never get the same
 * db, and a run's teardown releases only its own. A per-run counter checked
 * against `DBSIZE` once handed both of them db 1.
 */
describe('claiming a Redis db (integration)', () => {
  let client: Redis;
  const runs = [0, 1].map(() => `it_claim_${randomBytes(4).toString('hex')}`);

  beforeAll(async () => {
    client = new Redis({ ...inject('integrationServices').redis, lazyConnect: true });
    await client.connect();
  });

  afterAll(async () => {
    for (const run of runs) await releaseRedisDbs(client, run);
    client.disconnect();
  });

  it('gives two runs different dbs even when both are empty', async () => {
    const [first, second] = await Promise.all(runs.map((run) => claimRedisDb(client, run)));

    expect(first).not.toBe(second);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
  });

  it("releases one run's dbs and leaves the other's reserved", async () => {
    const mine = await claimRedisDb(client, runs[0]);
    const theirs = await claimRedisDb(client, runs[1]);
    await client.select(theirs);
    await client.set('kept', '1');
    await client.select(0);

    await releaseRedisDbs(client, runs[0]);

    expect(await client.get(`oppenheimer:integration:redis-db:${mine}`)).toBeNull();
    expect(await client.get(`oppenheimer:integration:redis-db:${theirs}`)).toBe(runs[1]);
    await client.select(theirs);
    expect(await client.get('kept')).toBe('1');
    await client.select(0);
  });
});
