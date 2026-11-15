import { createHash, randomUUID } from 'node:crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import { PauseDefaultBotHeartbeats1794775608906 } from '../migrations/1794775608906-PauseDefaultBotHeartbeats';
import { createTestDatabase } from './integration-services';
import { loadMigrations } from './run-migrations';

/**
 * Migration `PauseDefaultBotHeartbeats` on rows it meets in a deployment
 * (`26-bot-routines.md` §6, "Changed 2026-11-15"). What breaks this: a
 * heartbeat left running every hour, one moved to twice a day in the wrong
 * zone (another bot's, or none when the owner wrote with one), a heartbeat
 * whose owner chose its times (even only its minute) rewritten, another
 * routine touched, a row the automation and trigger CHECKs refuse, or a
 * `down` that leaves the two times in place.
 *
 * The rows are written with foreign keys off (`session_replication_role`):
 * what the migration reads is these three tables, not the bots, users and
 * revisions they point at.
 */
describe('migration PauseDefaultBotHeartbeats (integration)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  const organizationId = randomUUID();
  const ownerUserId = randomUUID();

  beforeAll(async () => {
    const { url } = await createTestDatabase();
    dataSource = new DataSource({ type: 'postgres', url, migrations: await loadMigrations() });
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
  }, 180000);

  afterAll(async () => {
    await runner?.release();
    await dataSource?.destroy();
  });

  /** The minute `heartbeatMinute` gave a bot's default heartbeat. */
  const defaultMinute = (botId: string) =>
    createHash('sha256').update(botId).digest().readUInt32BE(0) % 60;

  async function routine(
    name: string,
    triggers: { frequency: string; hour: number; minute?: number }[],
    paused = false,
    botId = randomUUID(),
  ): Promise<{ id: string; botId: string }> {
    const id = randomUUID();
    await runner.query(
      `INSERT INTO automation (id, "organizationId", "ownerUserId", name, "currentRevisionId",
         "runTarget", "botId", "pausedAt", "pausedReason")
       VALUES ($1, $2, $3, $4, $5, 'bot', $6, $7, $8)`,
      [
        id,
        organizationId,
        ownerUserId,
        name,
        randomUUID(),
        botId,
        paused ? new Date() : null,
        paused ? 'user' : null,
      ],
    );
    for (const [position, trigger] of triggers.entries()) {
      await runner.query(
        `INSERT INTO automation_trigger ("organizationId", "automationId", "position", source,
           "eventType", config, timezone, "nextFireAt")
         VALUES ($1, $2, $3, 'schedule', 'schedule', $4, 'UTC', $5)`,
        [
          organizationId,
          id,
          position,
          JSON.stringify({ minute: 17, ...trigger }),
          paused ? null : new Date(Date.now() + 3_600_000),
        ],
      );
    }
    return { id, botId };
  }

  /** A heartbeat on the one trigger it was given: hourly, in UTC, at its bot's minute. */
  const defaultHeartbeat = (paused = false) => {
    const botId = randomUUID();
    return routine(
      'Heartbeat',
      [{ frequency: 'hourly', hour: 0, minute: defaultMinute(botId) }],
      paused,
      botId,
    );
  };

  async function turn(botId: string, props: { lane: string; timeZone: string; at: string }) {
    await runner.query(
      `INSERT INTO bot_turn ("organizationId", "botId", "conversationId", "requestedByUserId",
         origin, lane, provider, model, "timeZone", "createdAt")
       VALUES ($1, $2, $3, $4, 'message', $5, 'glm', 'glm-5.3', $6, $7)`,
      [organizationId, botId, randomUUID(), ownerUserId, props.lane, props.timeZone, props.at],
    );
  }

  const stateOf = async (id: string) => {
    const [automation] = await dataSource.query(
      `SELECT "pausedReason", version FROM automation WHERE id = $1`,
      [id],
    );
    const triggers = await dataSource.query(
      `SELECT "position", config, timezone, "nextFireAt" FROM automation_trigger
        WHERE "automationId" = $1 ORDER BY "position"`,
      [id],
    );
    return { ...automation, triggers };
  };

  it('moves a default heartbeat to 09:00 and 18:00 in its owner’s zone, and pauses it', async () => {
    await runner.query(`SET session_replication_role = replica`);
    const madrid = await defaultHeartbeat();
    await turn(madrid.botId, { lane: 'owner', timeZone: 'Europe/Madrid', at: '2026-11-15T09:00Z' });
    // Newer, but another bot's ask in its routine's zone: not where the owner writes from.
    await turn(madrid.botId, { lane: 'bots', timeZone: 'Asia/Tokyo', at: '2026-11-15T10:00Z' });
    const nobodyWrote = await defaultHeartbeat();
    const chosen = await routine('Heartbeat', [{ frequency: 'daily', hour: 7 }]);
    const sameBot = randomUUID();
    const minuteMoved = await routine(
      'Heartbeat',
      [{ frequency: 'hourly', hour: 0, minute: (defaultMinute(sameBot) + 1) % 60 }],
      false,
      sameBot,
    );
    const pausedAlready = await defaultHeartbeat(true);
    const other = await routine('Sentry triage', [{ frequency: 'hourly', hour: 0 }]);
    await runner.query(`SET session_replication_role = DEFAULT`);

    await new PauseDefaultBotHeartbeats1794775608906().up(runner);

    const twice = (timezone: string) => [
      {
        position: 0,
        config: { frequency: 'daily', hour: 9, minute: 0 },
        timezone,
        nextFireAt: null,
      },
      {
        position: 1,
        config: { frequency: 'daily', hour: 18, minute: 0 },
        timezone,
        nextFireAt: null,
      },
    ];
    expect(await stateOf(madrid.id)).toEqual({
      pausedReason: 'user',
      version: 2,
      triggers: twice('Europe/Madrid'),
    });
    expect(await stateOf(nobodyWrote.id)).toMatchObject({
      pausedReason: 'user',
      triggers: twice('UTC'),
    });
    expect(await stateOf(chosen.id)).toMatchObject({
      pausedReason: 'user',
      triggers: [{ config: { frequency: 'daily', hour: 7, minute: 17 }, nextFireAt: null }],
    });
    expect(await stateOf(minuteMoved.id)).toMatchObject({
      pausedReason: 'user',
      triggers: [{ config: { frequency: 'hourly', minute: (defaultMinute(sameBot) + 1) % 60 } }],
    });
    expect(await stateOf(pausedAlready.id)).toMatchObject({
      pausedReason: 'user',
      version: 1,
      triggers: twice('UTC'),
    });
    const untouched = await stateOf(other.id);
    expect(untouched).toMatchObject({ pausedReason: null, version: 1 });
    expect(untouched.triggers).toHaveLength(1);
    expect(untouched.triggers[0].nextFireAt).not.toBeNull();

    await new PauseDefaultBotHeartbeats1794775608906().down(runner);
    expect(await stateOf(madrid.id)).toMatchObject({
      pausedReason: 'user',
      triggers: [
        {
          position: 0,
          config: { frequency: 'hourly', hour: 0, minute: defaultMinute(madrid.botId) },
          timezone: 'UTC',
          nextFireAt: null,
        },
      ],
    });
    expect((await stateOf(chosen.id)).triggers).toHaveLength(1);
    expect((await stateOf(other.id)).triggers).toHaveLength(1);
  });
});
