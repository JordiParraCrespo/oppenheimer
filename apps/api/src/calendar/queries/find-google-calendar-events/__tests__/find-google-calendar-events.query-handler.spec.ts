import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarConnectionRepositoryPort } from '../../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../../domain/calendar.errors';
import { CalendarConnectionEntity } from '../../../domain/calendar-connection.entity';
import {
  CalendarGrantRevokedError,
  type CalendarProviderPort,
  type CalendarReadGrant,
  type ProviderEventsRead,
} from '../../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../../infrastructure/token-sealer.port';
import { FindGoogleCalendarEventsQuery } from '../find-google-calendar-events.query';
import { FindGoogleCalendarEventsQueryHandler } from '../find-google-calendar-events.query-handler';

/**
 * Every account read at once, each failing on its own. What breaks if this
 * regresses: one revoked or unreachable account blanks the whole Google layer,
 * a revoked grant is asked again on every read, a legacy row never gets its
 * subject, or a quota that stopped every account reads as an empty month.
 * The real Postgres side of the same is `calendar.integration.spec.ts`.
 */
const ORG = randomUUID();
const USER = randomUUID();
const scope: AccessScope = {
  userId: USER,
  organizationId: ORG,
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const range = { from: '2026-10-01', to: '2026-10-31', timeZone: 'Europe/Madrid' };

function account(email: string, accountSubject: string | null = email): CalendarConnectionEntity {
  return CalendarConnectionEntity.connect({
    organizationId: ORG,
    userId: USER,
    accountEmail: email,
    accountSubject,
    colorIndex: 0,
    refreshTokenSealed: Buffer.from(email),
    scopes: [],
  });
}

const meeting = (id: string) => ({
  id,
  title: id,
  date: '2026-10-05',
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  busy: true,
  url: null,
  meetingUrl: null,
  dedupeKey: `${id}|2026-10-05T07:00:00.000Z`,
});

function build(
  rows: CalendarConnectionEntity[],
  answer: (email: string) => Promise<ProviderEventsRead>,
) {
  const connections: Pick<
    CalendarConnectionRepositoryPort,
    'findAllOwn' | 'markRevoked' | 'fillSubject'
  > = {
    findAllOwn: vi.fn(async () => rows),
    markRevoked: vi.fn(async () => undefined),
    fillSubject: vi.fn(async () => undefined),
  };
  const provider: Pick<CalendarProviderPort, 'isConfigured' | 'listEvents'> = {
    isConfigured: () => true,
    listEvents: vi.fn((grant: CalendarReadGrant) => answer(grant.refreshToken)),
  };
  const sealer: Pick<TokenSealerPort, 'isConfigured' | 'open'> = {
    isConfigured: () => true,
    open: (sealed: Buffer) => sealed.toString(),
  };
  const handler = new FindGoogleCalendarEventsQueryHandler(
    provider as CalendarProviderPort,
    sealer as TokenSealerPort,
    connections as CalendarConnectionRepositoryPort,
  );
  return {
    connections,
    provider,
    read: () => handler.execute(new FindGoogleCalendarEventsQuery({ scope, range })),
  };
}

describe('FindGoogleCalendarEventsQueryHandler', () => {
  it('leaves the other accounts’ events when one is revoked, and marks only that row', async () => {
    const work = account('work');
    const home = account('home');
    const { connections, read } = build([work, home], async (email) => {
      if (email === 'work') throw new CalendarGrantRevokedError('invalid_grant');
      return { events: [meeting('dentist')], account: null };
    });

    const result = await read();

    expect(result.accounts).toEqual([
      { id: work.id, status: 'revoked' },
      { id: home.id, status: 'ok' },
    ]);
    expect(result.events).toEqual([{ connectionId: home.id, event: meeting('dentist') }]);
    expect(connections.markRevoked).toHaveBeenCalledExactlyOnceWith(work);
  });

  it('draws a meeting both accounts hold once, from the oldest account, and an error marks only its account', async () => {
    const work = account('work');
    const home = account('home');
    const flaky = account('flaky');
    const { read } = build([work, home, flaky], async (email) => {
      if (email === 'flaky') throw new Error('socket hang up');
      return { events: [meeting('standup'), meeting(`${email}-only`)], account: null };
    });

    const result = await read();

    expect(result.events.map(({ connectionId, event }) => [connectionId, event.id])).toEqual([
      [work.id, 'standup'],
      [work.id, 'work-only'],
      [home.id, 'home-only'],
    ]);
    expect(result.accounts.map(({ status }) => status)).toEqual(['ok', 'ok', 'error']);
  });

  it('does not ask Google for an account already revoked', async () => {
    const gone = account('gone');
    gone.revoke();
    const { provider, read } = build([gone], async () => ({ events: [], account: null }));

    await expect(read()).resolves.toEqual({
      events: [],
      accounts: [{ id: gone.id, status: 'revoked' }],
    });
    expect(provider.listEvents).not.toHaveBeenCalled();
  });

  it('keys a row kept without a subject from the ID token a refresh returns', async () => {
    const legacy = account('legacy', null);
    const { connections, read } = build([legacy], async () => ({
      events: [],
      account: { subject: 'sub-legacy', email: 'legacy' },
    }));

    await read();

    expect(connections.fillSubject).toHaveBeenCalledExactlyOnceWith(legacy, 'sub-legacy');
  });

  it('answers CALENDAR_010 only when Google’s quota stopped every account it asked', async () => {
    const limited = () => Promise.reject(new AppError(CalendarErrors.GOOGLE_RATE_LIMITED));
    await expect(build([account('a'), account('b')], limited).read()).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });

    const some = build([account('a'), account('b')], (email) =>
      email === 'a' ? limited() : Promise.resolve({ events: [], account: null }),
    );
    await expect(some.read()).resolves.toMatchObject({
      accounts: [{ status: 'error' }, { status: 'ok' }],
    });
  });
});
