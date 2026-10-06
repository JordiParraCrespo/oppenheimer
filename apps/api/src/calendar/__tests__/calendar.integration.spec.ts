import { randomBytes, randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { CalendarConnectionMapper } from '../calendar-connection.mapper';
import { CalendarEventMapper } from '../calendar-event.mapper';
import { CalendarConnectionOrmEntity } from '../database/calendar-connection.orm-entity';
import { CalendarConnectionRepository } from '../database/calendar-connection.repository';
import { CalendarEventOrmEntity } from '../database/calendar-event.orm-entity';
import { CalendarEventRepository } from '../database/calendar-event.repository';
import { CalendarConnectionEntity } from '../domain/calendar-connection.entity';
import { CalendarEventEntity } from '../domain/calendar-event.entity';

/**
 * Plan's calendar against a real Postgres: the event times the database holds, the
 * month read, and a Google connection that only its owner reads.
 */
describe('calendar (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let events: CalendarEventRepository;
  let connections: CalendarConnectionRepository;
  let organizationId: string;
  let userId: string;

  const scopeOf = (user: string): AccessScope => ({
    userId: user,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  });

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [CalendarEventOrmEntity, CalendarConnectionOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    events = new CalendarEventRepository(
      dataSource.getRepository(CalendarEventOrmEntity),
      new CalendarEventMapper(),
    );
    connections = new CalendarConnectionRepository(
      dataSource.getRepository(CalendarConnectionOrmEntity),
      new CalendarConnectionMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  beforeEach(async () => {
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    userId = await insertUser();
  });

  const event = (date: string, times: Partial<CalendarEventEntity['props']> = {}) =>
    CalendarEventEntity.createNew({
      organizationId,
      title: `on ${date}`,
      notes: '',
      date,
      allDay: false,
      startTime: '10:00',
      endTime: '10:30',
      busy: true,
      createdByUserId: userId,
      ...times,
    });

  it('reads a month of events by day, all-day first, and nothing outside the range', async () => {
    await events.insert(event('2026-10-05', { startTime: '15:00', endTime: '16:00' }));
    await events.insert(event('2026-10-05', { allDay: true, startTime: null, endTime: null }));
    await events.insert(event('2026-10-05'));
    await events.insert(event('2026-11-02'));
    const october = await events.findInRange(scopeOf(userId), {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(october.map((e) => [e.date, e.allDay, e.startTime])).toEqual([
      ['2026-10-05', true, null],
      ['2026-10-05', false, '10:00'],
      ['2026-10-05', false, '15:00'],
    ]);
  });

  it('holds an event’s times in the database: no end before its start, no times on an all-day event', async () => {
    const bad = event('2026-10-05');
    const record = new CalendarEventMapper().toPersistence(bad);
    await expect(
      dataSource.getRepository(CalendarEventOrmEntity).insert({ ...record, endTime: '09:00' }),
    ).rejects.toThrow(/CHK_calendar_event_times/);
    await expect(
      dataSource.getRepository(CalendarEventOrmEntity).insert({ ...record, allDay: true }),
    ).rejects.toThrow(/CHK_calendar_event_times/);
  });

  it('reads a Google connection for its owner only, replaces it on reconnect, and forgets it', async () => {
    const colleague = await insertUser();
    const connect = (email: string) =>
      CalendarConnectionEntity.connect({
        organizationId,
        userId,
        accountEmail: email,
        refreshTokenSealed: randomBytes(48),
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });
    await connections.upsert(connect('ana@example.com'));
    await connections.upsert(connect('ana.work@example.com'));
    const own = (await connections.findOwn(scopeOf(userId))).unwrap();
    expect(own.accountEmail).toBe('ana.work@example.com');
    expect((await connections.findOwn(scopeOf(colleague))).isNone()).toBe(true);

    await connections.markRevoked(own);
    expect((await connections.findOwn(scopeOf(userId))).unwrap().isActive).toBe(false);
    await connections.delete(own);
    expect((await connections.findOwn(scopeOf(userId))).isNone()).toBe(true);
  });
});
