import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { ChatgptCredentialResolver } from '../../../application/chatgpt-credential.resolver';
import { ModelProviderResolver } from '../../../application/model-provider.resolver';
import { ChatgptSignInMapper } from '../../../chatgpt-sign-in.mapper';
import type {
  ChatgptAuthPort,
  ChatgptDevicePoll,
  ChatgptTokens,
} from '../../../infrastructure/chatgpt-auth.port';
import { ChatgptAuthRefusedError } from '../../../infrastructure/chatgpt-auth.port';
import type { ProviderKeySealerPort } from '../../../infrastructure/provider-key-sealer.port';
import { PollChatgptLoginCommand } from '../poll-chatgpt-login.command';
import { PollChatgptLoginCommandHandler } from '../poll-chatgpt-login.command-handler';

/**
 * One poll of a ChatGPT sign-in: a sign-in still waiting stores nothing, an
 * approved one is stored for the poller's workspace, and a sign-in that lapsed,
 * was started in another workspace, was tampered with or that ChatGPT refused
 * answers BOTS_016 without storing anything (and, but for the refusal, without
 * asking ChatGPT).
 */
const organizationId = randomUUID();
const scope = (org: string | null = organizationId): AccessScope => ({
  userId: randomUUID(),
  organizationId: org,
  teamIds: [],
  grants: new Map(),
  bypass: false,
});

const tokens: ChatgptTokens = {
  accessToken: 'access-placeholder',
  refreshToken: 'refresh-placeholder',
  expiresAt: new Date('2026-10-25T00:00:00.000Z'),
  accountId: 'account-placeholder',
};

/** Seals by prefixing, so a flow id is readable in the spec and a forged one fails to open. */
const sealer: ProviderKeySealerPort = {
  isConfigured: () => true,
  seal: (plaintext) => Buffer.from(`sealed:${plaintext}`),
  open: (sealed) => {
    const text = sealed.toString();
    if (!text.startsWith('sealed:')) throw new Error('Not sealed here');
    return text.slice('sealed:'.length);
  },
};
const mapper = new ChatgptSignInMapper();

function flowId(overrides: { organizationId?: string; expiresAt?: Date } = {}): string {
  const flow = mapper.toLoginFlow({
    deviceAuthId: 'device-placeholder',
    userCode: 'ABCD-1234',
    organizationId: overrides.organizationId ?? organizationId,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
  });
  return sealer.seal(flow).toString('base64url');
}

function setup(poll: () => Promise<ChatgptDevicePoll>) {
  const auth: Pick<ChatgptAuthPort, 'pollDeviceCode'> = { pollDeviceCode: vi.fn(poll) };
  const chatgpt: Pick<ChatgptCredentialResolver, 'connect'> = { connect: vi.fn() };
  const handler = new PollChatgptLoginCommandHandler(
    new ModelProviderResolver(sealer),
    auth as ChatgptAuthPort,
    sealer,
    mapper,
    chatgpt as ChatgptCredentialResolver,
  );
  return { handler, auth, chatgpt };
}

const command = (id: string, s = scope()) => new PollChatgptLoginCommand({ scope: s, flowId: id });

describe('PollChatgptLoginCommandHandler', () => {
  it('answers false and stores nothing while the person has not approved the code', async () => {
    const { handler, auth, chatgpt } = setup(async () => ({ status: 'pending' }));
    await expect(handler.execute(command(flowId()))).resolves.toBe(false);
    expect(auth.pollDeviceCode).toHaveBeenCalledWith(
      expect.objectContaining({ deviceAuthId: 'device-placeholder', userCode: 'ABCD-1234' }),
    );
    expect(chatgpt.connect).not.toHaveBeenCalled();
  });

  it("stores an approved sign-in for the poller's workspace and answers true", async () => {
    const { handler, chatgpt } = setup(async () => ({ status: 'authorized', tokens }));
    const caller = scope();
    await expect(handler.execute(command(flowId(), caller))).resolves.toBe(true);
    expect(chatgpt.connect).toHaveBeenCalledWith(organizationId, caller.userId, tokens);
  });

  it.each([
    ['lapsed', () => flowId({ expiresAt: new Date(Date.now() - 1) })],
    ['started in another workspace', () => flowId({ organizationId: randomUUID() })],
    ['not sealed by this server', () => Buffer.from('forged').toString('base64url')],
  ])('refuses a sign-in that is %s with BOTS_016, without asking ChatGPT', async (_, id) => {
    const { handler, auth, chatgpt } = setup(async () => ({ status: 'authorized', tokens }));
    await expect(handler.execute(command(id()))).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(auth.pollDeviceCode).not.toHaveBeenCalled();
    expect(chatgpt.connect).not.toHaveBeenCalled();
  });

  it('refuses a sign-in ChatGPT refused with BOTS_016, and stores nothing', async () => {
    const { handler, chatgpt } = setup(async () => {
      throw new ChatgptAuthRefusedError('/oauth/token answered 400');
    });
    await expect(handler.execute(command(flowId()))).rejects.toMatchObject({ code: 'BOTS_016' });
    expect(chatgpt.connect).not.toHaveBeenCalled();
  });
});
