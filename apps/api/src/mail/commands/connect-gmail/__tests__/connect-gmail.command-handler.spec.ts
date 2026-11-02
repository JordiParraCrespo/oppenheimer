import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AccessScope } from '../../../../authz/domain/access-scope.types';
import type { GmailConnectStateResolver } from '../../../application/gmail-connect-state.resolver';
import type { GmailConnectionRepositoryPort } from '../../../database/gmail-connection.repository.port';
import { GmailConnectionEntity } from '../../../domain/gmail-connection.entity';
import {
  GMAIL_SCOPE,
  type GmailGrant,
  type GmailProviderPort,
} from '../../../infrastructure/gmail-provider.port';
import type { TokenSealerPort } from '../../../infrastructure/token-sealer.port';
import { ConnectGmailCommand } from '../connect-gmail.command';
import { ConnectGmailCommandHandler } from '../connect-gmail.command-handler';

/**
 * Which row a fresh Gmail grant lands on, and which grants are never stored.
 * What breaks if this regresses: a grant that cannot read or send mail (the
 * box left unticked) is kept and every bot call fails later, a reconnect adds
 * a second copy of the account and drops its name, or a sixth account gets in.
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

const GRANT: GmailGrant = {
  refreshToken: '1//fresh',
  account: { subject: 'sub-work', email: 'ana@work.example' },
  scopes: ['openid', 'email', GMAIL_SCOPE],
};

function held(
  props: Partial<Parameters<typeof GmailConnectionEntity.connect>[0]> = {},
): GmailConnectionEntity {
  return GmailConnectionEntity.connect({
    organizationId: ORG,
    userId: USER,
    googleSubject: 'sub-home',
    accountEmail: 'ana@home.example',
    label: 'Personal',
    refreshTokenSealed: Buffer.from('old'),
    scopes: [GMAIL_SCOPE],
    ...props,
  });
}

function build(rows: GmailConnectionEntity[], grant: GmailGrant = GRANT) {
  const connections: Pick<GmailConnectionRepositoryPort, 'findAllOwn' | 'insert' | 'save'> = {
    findAllOwn: vi.fn(async () => rows),
    insert: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
  const provider: Pick<GmailProviderPort, 'isConfigured' | 'exchange'> = {
    isConfigured: () => true,
    exchange: vi.fn(async () => grant),
  };
  const sealer: Pick<TokenSealerPort, 'isConfigured' | 'seal'> = {
    isConfigured: () => true,
    seal: (token: string) => Buffer.from(`sealed:${token}`),
  };
  const states: Pick<GmailConnectStateResolver, 'redeem'> = {
    redeem: vi.fn(async () => undefined),
  };
  const handler = new ConnectGmailCommandHandler(
    provider as GmailProviderPort,
    sealer as TokenSealerPort,
    connections as GmailConnectionRepositoryPort,
    states as GmailConnectStateResolver,
  );
  const connect = () =>
    handler.execute(new ConnectGmailCommand({ scope, input: { code: 'c', state: 's' } }));
  return { connections, connect };
}

describe('ConnectGmailCommandHandler', () => {
  it('adds a new account, sealed, named after its address until the person renames it', async () => {
    const { connections, connect } = build([held()]);

    await connect();

    expect(connections.insert).toHaveBeenCalledOnce();
    const added = vi.mocked(connections.insert).mock.calls[0][0];
    expect(added).toMatchObject({
      googleSubject: 'sub-work',
      accountEmail: 'ana@work.example',
      label: 'ana',
      status: 'active',
    });
    expect(added.refreshTokenSealed.toString()).toBe('sealed:1//fresh');
  });

  it('reconnects an account already held in place, keeping its name', async () => {
    const work = held({
      googleSubject: 'sub-work',
      accountEmail: 'old@work.example',
      label: 'Work',
    });
    work.revoke();
    const { connections, connect } = build([held(), work]);

    await expect(connect()).resolves.toBe(work.id);

    expect(connections.insert).not.toHaveBeenCalled();
    expect(connections.save).toHaveBeenCalledWith(work);
    expect(work).toMatchObject({
      label: 'Work',
      accountEmail: 'ana@work.example',
      status: 'active',
    });
  });

  it('refuses a grant without the Gmail permission with MAIL_006 and stores nothing', async () => {
    const { connections, connect } = build([], { ...GRANT, scopes: ['openid', 'email'] });

    await expect(connect()).rejects.toMatchObject({ code: 'MAIL_006' });
    expect(connections.insert).not.toHaveBeenCalled();
  });

  it('refuses a grant that does not say which account it is with MAIL_006', async () => {
    const { connections, connect } = build([], { ...GRANT, account: null });

    await expect(connect()).rejects.toMatchObject({ code: 'MAIL_006' });
    expect(connections.insert).not.toHaveBeenCalled();
  });

  it('refuses a sixth account with MAIL_003 and stores nothing', async () => {
    const five = Array.from({ length: 5 }, (_, index) => held({ googleSubject: `sub-${index}` }));
    const { connections, connect } = build(five);

    await expect(connect()).rejects.toMatchObject({ code: 'MAIL_003' });
    expect(connections.insert).not.toHaveBeenCalled();
  });
});
