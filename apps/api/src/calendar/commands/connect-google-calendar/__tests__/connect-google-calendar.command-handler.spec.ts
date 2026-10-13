import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import type { GoogleConnectStateResolver } from '../../../application/google-connect-state.resolver';
import type { CalendarConnectionRepositoryPort } from '../../../database/calendar-connection.repository.port';
import { CalendarConnectionEntity } from '../../../domain/calendar-connection.entity';
import {
  type CalendarGrant,
  type CalendarProviderPort,
  GOOGLE_CALENDAR_SCOPE,
} from '../../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../../infrastructure/token-sealer.port';
import { ConnectGoogleCalendarCommand } from '../connect-google-calendar.command';
import { ConnectGoogleCalendarCommandHandler } from '../connect-google-calendar.command-handler';

/**
 * Which row a fresh grant lands on. What breaks if this regresses: reconnecting
 * an account adds a second copy of it (or takes a new colour), a row kept
 * before subjects were never gets one, a grant with no ID token is stored
 * unkeyed, or a sixth account gets in. The index that backs the last two is
 * `calendar.integration.spec.ts`'s.
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

const GRANT: CalendarGrant = {
  refreshToken: '1//fresh',
  account: { subject: 'sub-work', email: 'ana@work.example' },
  scopes: ['openid', 'email', GOOGLE_CALENDAR_SCOPE],
};

function held(
  props: Partial<Parameters<typeof CalendarConnectionEntity.connect>[0]> = {},
): CalendarConnectionEntity {
  return CalendarConnectionEntity.connect({
    organizationId: ORG,
    userId: USER,
    accountEmail: 'ana@home.example',
    accountSubject: 'sub-home',
    colorIndex: 0,
    refreshTokenSealed: Buffer.from('old'),
    scopes: [GOOGLE_CALENDAR_SCOPE],
    ...props,
  });
}

function build(rows: CalendarConnectionEntity[], grant: CalendarGrant = GRANT) {
  const connections: Pick<CalendarConnectionRepositoryPort, 'findAllOwn' | 'insert' | 'save'> = {
    findAllOwn: vi.fn(async () => rows),
    insert: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
  const provider: Pick<CalendarProviderPort, 'isConfigured' | 'exchange'> = {
    isConfigured: () => true,
    exchange: vi.fn(async () => grant),
  };
  const sealer: Pick<TokenSealerPort, 'isConfigured' | 'seal'> = {
    isConfigured: () => true,
    seal: (token: string) => Buffer.from(`sealed:${token}`),
  };
  const states: Pick<GoogleConnectStateResolver, 'redeem'> = {
    redeem: vi.fn(async () => undefined),
  };
  const handler = new ConnectGoogleCalendarCommandHandler(
    provider as CalendarProviderPort,
    sealer as TokenSealerPort,
    connections as CalendarConnectionRepositoryPort,
    states as GoogleConnectStateResolver,
  );
  const connect = () =>
    handler.execute(new ConnectGoogleCalendarCommand({ scope, input: { code: 'c', state: 's' } }));
  return { connections, connect };
}

describe('ConnectGoogleCalendarCommandHandler', () => {
  it('adds another account in the lowest colour the person’s others leave free', async () => {
    const { connections, connect } = build([
      held({ colorIndex: 0 }),
      held({ accountSubject: 'sub-x', colorIndex: 2 }),
    ]);

    await connect();

    const [added] = vi.mocked(connections.insert).mock.calls[0];
    expect([added.accountSubject, added.accountEmail, added.colorIndex]).toEqual([
      'sub-work',
      'ana@work.example',
      1,
    ]);
    expect(connections.save).not.toHaveBeenCalled();
  });

  it('reconnects an account it already has in place, keeping its colour and making it active', async () => {
    const work = held({
      accountSubject: 'sub-work',
      accountEmail: 'old@work.example',
      colorIndex: 3,
    });
    work.revoke();
    const { connections, connect } = build([held(), work]);

    await expect(connect()).resolves.toBe(work.id);

    expect(connections.save).toHaveBeenCalledWith(work);
    expect([work.isActive, work.colorIndex, work.accountEmail]).toEqual([
      true,
      3,
      'ana@work.example',
    ]);
    expect(work.refreshTokenSealed.toString()).toBe('sealed:1//fresh');
    expect(connections.insert).not.toHaveBeenCalled();
  });

  it('keys a row kept before subjects were by its address, instead of adding a copy', async () => {
    const legacy = held({ accountSubject: null, accountEmail: 'Ana@Work.example' });
    const { connections, connect } = build([legacy]);

    await connect();

    expect(connections.save).toHaveBeenCalledWith(legacy);
    expect(legacy.accountSubject).toBe('sub-work');
    expect(connections.insert).not.toHaveBeenCalled();
  });

  it('refuses a grant with no ID token with CALENDAR_006 and writes nothing', async () => {
    const { connections, connect } = build([], { ...GRANT, account: null });

    await expect(connect()).rejects.toMatchObject({ code: 'CALENDAR_006' });
    expect(connections.insert).not.toHaveBeenCalled();
    expect(connections.save).not.toHaveBeenCalled();
  });

  it('refuses a sixth account with CALENDAR_011, but still reconnects one of the five', async () => {
    const five = [0, 1, 2, 3, 4].map((colorIndex) =>
      held({ accountSubject: `sub-${colorIndex}`, colorIndex }),
    );
    const sixth = build(five);
    await expect(sixth.connect()).rejects.toMatchObject({ code: 'CALENDAR_011' });
    expect(sixth.connections.insert).not.toHaveBeenCalled();

    const again = build(five, {
      ...GRANT,
      account: { subject: 'sub-2', email: 'two@example.com' },
    });
    await expect(again.connect()).resolves.toBe(five[2].id);
  });
});
