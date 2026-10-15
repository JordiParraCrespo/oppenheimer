import { randomUUID } from 'node:crypto';
import { ChatgptSignInMapper } from '../chatgpt-sign-in.mapper';

/**
 * The two sealed shapes of a ChatGPT sign-in read back as they were written,
 * and anything else (a plain API key, a sign-in missing its account or its
 * workspace) reads as none, so a turn or a poll never runs on half a sign-in.
 */
describe('ChatgptSignInMapper', () => {
  const mapper = new ChatgptSignInMapper();
  const tokens = {
    accessToken: 'access-placeholder',
    refreshToken: 'refresh-placeholder',
    expiresAt: new Date('2026-10-20T08:00:00.000Z'),
    accountId: 'account-placeholder',
  };

  it('reads back the tokens it sealed, and refuses a secret that is not a sign-in', () => {
    expect(mapper.tokensOf(mapper.toSecret(tokens))).toEqual(tokens);
    expect(mapper.tokensOf('sk-a-plain-api-key')).toBeNull();
    expect(mapper.tokensOf(JSON.stringify({ ...tokens, accountId: '' }))).toBeNull();
  });

  it('reads back a sign-in in progress, and refuses one missing its workspace', () => {
    const flow = {
      deviceAuthId: 'device-placeholder',
      userCode: 'ABCD-1234',
      organizationId: randomUUID(),
      expiresAt: new Date('2026-10-15T12:15:00.000Z'),
      intervalSeconds: 5,
    };
    expect(mapper.loginFlowOf(mapper.toLoginFlow(flow))).toEqual(flow);
    const { organizationId: _, ...withoutWorkspace } = flow;
    expect(mapper.loginFlowOf(JSON.stringify({ ...withoutWorkspace, expiresAt: 1 }))).toBeNull();
  });
});
