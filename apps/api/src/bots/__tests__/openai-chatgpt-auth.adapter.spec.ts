import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatgptAuthRefusedError } from '../infrastructure/chatgpt-auth.port';
import { OpenAiChatgptAuthAdapter } from '../infrastructure/openai-chatgpt-auth.adapter';

/**
 * The ChatGPT device sign-in against a `fetch` double, as the Codex CLI runs
 * it: a 403 or 404 from the poll is "not approved yet", an approval is
 * redeemed at `/oauth/token` with the verifier ChatGPT handed back, the
 * account comes from the access token's claims, a refused refresh is told
 * apart from an unreachable server, and a refusal for rate pauses every later
 * call (`.agents/rules/integrations.md`).
 */

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** An access token whose claims name `accountId`, as OpenAI's do. */
function accessToken(accountId: string): string {
  const claims = { 'https://api.openai.com/auth': { chatgpt_account_id: accountId } };
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

const TOKENS = (accountId = 'account-placeholder') =>
  json(200, {
    access_token: accessToken(accountId),
    refresh_token: 'refresh-next',
    expires_in: 3600,
  });

const CODE = { deviceAuthId: 'device-placeholder', userCode: 'ABCD-1234' };

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiChatgptAuthAdapter', () => {
  it('asks for a device code with the Codex client, and points the person at the device page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { device_auth_id: 'device-placeholder', user_code: 'ABCD-1234', interval: '7' }),
      );
    vi.stubGlobal('fetch', fetch);

    await expect(new OpenAiChatgptAuthAdapter().requestDeviceCode()).resolves.toEqual({
      ...CODE,
      verificationUrl: 'https://auth.openai.com/codex/device',
      intervalSeconds: 7,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://auth.openai.com/api/accounts/deviceauth/usercode');
    expect(JSON.parse(init.body)).toEqual({ client_id: 'app_EMoamEEZ73f0CkXaXp7hrann' });
  });

  it.each([403, 404])('reads a %s from the poll as not approved yet', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(status, { error: 'pending' })));
    await expect(new OpenAiChatgptAuthAdapter().pollDeviceCode(CODE)).resolves.toEqual({
      status: 'pending',
    });
  });

  it('redeems an approval with its verifier and reads the account from the token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, {
          authorization_code: 'code-placeholder',
          code_verifier: 'verifier-placeholder',
          code_challenge: 'x',
        }),
      )
      .mockResolvedValueOnce(TOKENS());
    vi.stubGlobal('fetch', fetch);

    const poll = await new OpenAiChatgptAuthAdapter().pollDeviceCode(CODE);
    expect(poll).toMatchObject({
      status: 'authorized',
      tokens: { refreshToken: 'refresh-next', accountId: 'account-placeholder' },
    });
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe('https://auth.openai.com/oauth/token');
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      grant_type: 'authorization_code',
      code: 'code-placeholder',
      code_verifier: 'verifier-placeholder',
      redirect_uri: 'https://auth.openai.com/deviceauth/callback',
    });
  });

  it('tells a refused refresh (sign in again) from an unreachable server (try later)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(401, { error: 'invalid_grant' }))
        .mockResolvedValueOnce(json(503, {})),
    );
    const adapter = new OpenAiChatgptAuthAdapter();
    await expect(adapter.refresh('refresh-spent')).rejects.toBeInstanceOf(ChatgptAuthRefusedError);
    await expect(adapter.refresh('refresh-spent')).rejects.toMatchObject({ code: 'BOTS_020' });
  });

  it('refuses a token answer that names no account, rather than storing a sign-in turns cannot use', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json(200, { access_token: 'opaque', refresh_token: 'r', expires_in: 60 }),
        ),
    );
    await expect(new OpenAiChatgptAuthAdapter().refresh('refresh')).rejects.toMatchObject({
      code: 'BOTS_020',
    });
  });

  it('answers a rate refusal with BOTS_019 and asks nothing more until it lapses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '60' } }));
    vi.stubGlobal('fetch', fetch);
    const adapter = new OpenAiChatgptAuthAdapter();

    await expect(adapter.requestDeviceCode()).rejects.toMatchObject({ code: 'BOTS_019' });
    await expect(adapter.pollDeviceCode(CODE)).rejects.toMatchObject({ code: 'BOTS_019' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
