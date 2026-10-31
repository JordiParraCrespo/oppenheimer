import { randomBytes, randomUUID } from 'node:crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { GoogleConnectStateResolver } from '../application/google-connect-state.resolver';
import { CalendarConnectionMapper } from '../calendar-connection.mapper';
import { CalendarEventMapper } from '../calendar-event.mapper';
import { ConnectGoogleCalendarCommand } from '../commands/connect-google-calendar/connect-google-calendar.command';
import { ConnectGoogleCalendarCommandHandler } from '../commands/connect-google-calendar/connect-google-calendar.command-handler';
import { RemoveGoogleCalendarConnectionCommand } from '../commands/remove-google-calendar-connection/remove-google-calendar-connection.command';
import { RemoveGoogleCalendarConnectionCommandHandler } from '../commands/remove-google-calendar-connection/remove-google-calendar-connection.command-handler';
import { CalendarConnectionOrmEntity } from '../database/calendar-connection.orm-entity';
import { CalendarConnectionRepository } from '../database/calendar-connection.repository';
import { CalendarEventOrmEntity } from '../database/calendar-event.orm-entity';
import { CalendarEventRepository } from '../database/calendar-event.repository';
import { CalendarConnectionEntity } from '../domain/calendar-connection.entity';
import { CalendarEventEntity } from '../domain/calendar-event.entity';
import {
  type CalendarGrant,
  CalendarGrantRevokedError,
  type CalendarProviderPort,
  type CalendarReadGrant,
  GOOGLE_CALENDAR_SCOPE,
  type ProviderEventsRead,
} from '../infrastructure/calendar-provider.port';
import { googleEventsToProvider } from '../infrastructure/google-calendar-event.util';
import type { TokenSealerPort } from '../infrastructure/token-sealer.port';
import { FindGoogleCalendarEventsQuery } from '../queries/find-google-calendar-events/find-google-calendar-events.query';
import { FindGoogleCalendarEventsQueryHandler } from '../queries/find-google-calendar-events/find-google-calendar-events.query-handler';

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
    calendars = new Map();
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

  /**
   * Google, faked at the port: a code exchange answers the account `nextGrant`
   * names, and a read answers what `calendars` holds for the refresh token
   * (`sealer` seals by prefixing, so the token is the account's subject).
   */
  let nextGrant: CalendarGrant;
  let calendars: Map<string, () => Promise<ProviderEventsRead>>;
  const range = { from: '2026-10-01', to: '2026-10-31', timeZone: 'UTC' };
  const sealer: TokenSealerPort = {
    isConfigured: () => true,
    seal: (token: string) => Buffer.from(`sealed:${token}`),
    open: (sealed: Buffer) => sealed.toString().replace(/^sealed:/, ''),
  } as TokenSealerPort;
  const provider = {
    isConfigured: () => true,
    authorizationUrl: () => 'https://accounts.example.test',
    exchange: async () => nextGrant,
    listEvents: async (grant: CalendarReadGrant) =>
      (calendars.get(grant.refreshToken) ?? (async () => ({ events: [], account: null })))(),
    revoke: async () => undefined,
  } satisfies CalendarProviderPort;
  const states = { redeem: async () => undefined } as unknown as GoogleConnectStateResolver;

  async function connectAccount(subject: string, email = `${subject}@example.com`, user = userId) {
    nextGrant = {
      refreshToken: subject,
      account: { subject, email },
      scopes: ['openid', 'email', GOOGLE_CALENDAR_SCOPE],
    };
    return new ConnectGoogleCalendarCommandHandler(provider, sealer, connections, states).execute(
      new ConnectGoogleCalendarCommand({ scope: scopeOf(user), input: { code: 'c', state: 's' } }),
    );
  }

  const readGoogle = () =>
    new FindGoogleCalendarEventsQueryHandler(provider, sealer, connections).execute(
      new FindGoogleCalendarEventsQuery({ scope: scopeOf(userId), range }),
    );

  const weeklySync = (account: string): ProviderEventsRead => ({
    account: null,
    events: googleEventsToProvider(
      {
        items: ['2026-10-05', '2026-10-12', '2026-10-19'].map((day) => ({
          id: `${account}-${day}`,
          iCalUID: 'weekly-sync@acme',
          summary: 'Weekly sync',
          originalStartTime: { dateTime: `${day}T09:00:00Z` },
          start: { dateTime: `${day}T09:00:00Z` },
          end: { dateTime: `${day}T09:30:00Z` },
        })),
      },
      range,
    ),
  });

  it('lists two accounts for their owner only, reads both and draws a shared recurring meeting once per occurrence', async () => {
    const colleague = await insertUser();
    const work = await connectAccount('sub-work');
    const home = await connectAccount('sub-home');
    calendars.set('sub-work', async () => weeklySync('work'));
    calendars.set('sub-home', async () => {
      const read = weeklySync('home');
      read.events.push(
        ...googleEventsToProvider(
          {
            items: [
              {
                id: 'dentist',
                iCalUID: 'dentist@home',
                start: { dateTime: '2026-10-07T16:00:00Z' },
              },
            ],
          },
          range,
        ),
      );
      return read;
    });

    const own = await connections.findAllOwn(scopeOf(userId));
    expect(own.map((c) => [c.id, c.accountEmail, c.colorIndex, c.status])).toEqual([
      [work, 'sub-work@example.com', 0, 'active'],
      [home, 'sub-home@example.com', 1, 'active'],
    ]);
    expect(await connections.findAllOwn(scopeOf(colleague))).toEqual([]);

    const read = await readGoogle();
    expect(read.accounts).toEqual([
      { id: work, status: 'ok' },
      { id: home, status: 'ok' },
    ]);
    expect(
      read.events.map(({ connectionId, event }) => [connectionId, event.date, event.title]),
    ).toEqual([
      [work, '2026-10-05', 'Weekly sync'],
      [work, '2026-10-12', 'Weekly sync'],
      [work, '2026-10-19', 'Weekly sync'],
      [home, '2026-10-07', ''],
    ]);
  });

  it('leaves the other account’s events when one is revoked, and keeps that row revoked', async () => {
    const work = await connectAccount('sub-work');
    const home = await connectAccount('sub-home');
    calendars.set('sub-work', async () => {
      throw new CalendarGrantRevokedError('invalid_grant');
    });
    calendars.set('sub-home', async () => weeklySync('home'));

    const read = await readGoogle();

    expect(read.accounts).toEqual([
      { id: work, status: 'revoked' },
      { id: home, status: 'ok' },
    ]);
    expect(new Set(read.events.map(({ connectionId }) => connectionId))).toEqual(new Set([home]));
    const stored = await connections.findAllOwn(scopeOf(userId));
    expect(stored.map((c) => c.status)).toEqual(['revoked', 'active']);

    // Reconnecting the account brings that row back, colour kept, no copy.
    await expect(connectAccount('sub-work')).resolves.toBe(work);
    const after = await connections.findAllOwn(scopeOf(userId));
    expect(after.map((c) => [c.id, c.status, c.colorIndex])).toEqual([
      [work, 'active', 0],
      [home, 'active', 1],
    ]);
  });

  it('takes five accounts and refuses a sixth with CALENDAR_011, writing nothing', async () => {
    for (const n of [1, 2, 3, 4, 5]) await connectAccount(`sub-${n}`);

    await expect(connectAccount('sub-6')).rejects.toMatchObject({ code: 'CALENDAR_011' });
    const own = await connections.findAllOwn(scopeOf(userId));
    expect(own.map((c) => c.colorIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('refuses a second row with no subject for the same person, by the index', async () => {
    const legacy = (email: string) =>
      CalendarConnectionEntity.connect({
        organizationId,
        userId,
        accountEmail: email,
        accountSubject: null,
        colorIndex: 0,
        refreshTokenSealed: randomBytes(48),
        scopes: [GOOGLE_CALENDAR_SCOPE],
      });
    await connections.insert(legacy('ana@example.com'));

    await expect(connections.insert(legacy('ana.work@example.com'))).rejects.toThrow(
      /UQ_calendar_connection_user_unkeyed/,
    );
    // The same account connected again keys the row it already has.
    await connectAccount('sub-ana', 'ana@example.com');
    const own = await connections.findAllOwn(scopeOf(userId));
    expect(own.map((c) => [c.accountSubject, c.accountEmail])).toEqual([
      ['sub-ana', 'ana@example.com'],
    ]);
  });

  it('frees a removed account’s colour for the next one, and the others keep theirs', async () => {
    const colleague = await insertUser();
    const first = await connectAccount('sub-a');
    const second = await connectAccount('sub-b');
    const third = await connectAccount('sub-c');
    const remove = new RemoveGoogleCalendarConnectionCommandHandler(provider, sealer, connections);

    // Someone else cannot remove it: their remove finds nothing.
    await remove.execute(
      new RemoveGoogleCalendarConnectionCommand({
        scope: scopeOf(colleague),
        connectionId: second,
      }),
    );
    expect(await connections.findAllOwn(scopeOf(userId))).toHaveLength(3);

    await remove.execute(
      new RemoveGoogleCalendarConnectionCommand({ scope: scopeOf(userId), connectionId: second }),
    );
    const fourth = await connectAccount('sub-d');

    const own = await connections.findAllOwn(scopeOf(userId));
    expect(own.map((c) => [c.id, c.colorIndex])).toEqual([
      [first, 0],
      [third, 2],
      [fourth, 1],
    ]);
  });
});
