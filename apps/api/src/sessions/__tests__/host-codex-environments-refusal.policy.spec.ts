import { codexEnvironmentsOrThrow } from '../application/host-codex-environments-refusal.policy';

/**
 * What the composer's Codex environment picker answers for each way the host's
 * list can fail. The part worth a test is the runner's refusal: ChatGPT's rate
 * limit (`SESS_010`) is a 429 of its own, never folded into "Codex could not
 * list", which would tell the person to check a sign-in that works.
 */
describe('codexEnvironmentsOrThrow', () => {
  const HOST = 'host-1';

  it('answers ChatGPT’s rate limit with SESSIONS_047, keeping the runner’s words and code', () => {
    expect(() =>
      codexEnvironmentsOrThrow(
        { kind: 'failed', code: 'SESS_010', detail: 'try again in 30s' },
        HOST,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'SESSIONS_047',
        detail: 'try again in 30s',
        extensions: { upstreamCode: 'SESS_010' },
      }),
    );
  });

  it('answers any other refusal with SESSIONS_046', () => {
    expect(() =>
      codexEnvironmentsOrThrow({ kind: 'failed', code: 'SESS_009', detail: 'Not signed in' }, HOST),
    ).toThrow(expect.objectContaining({ code: 'SESSIONS_046', detail: 'Not signed in' }));
  });

  it('answers a host that holds no link, and a runner that cannot list, with their own codes', () => {
    expect(() => codexEnvironmentsOrThrow({ kind: 'host_offline' }, HOST)).toThrow(
      expect.objectContaining({ code: 'SESSIONS_045' }),
    );
    expect(() => codexEnvironmentsOrThrow({ kind: 'not_supported' }, HOST)).toThrow(
      expect.objectContaining({ code: 'SESSIONS_044' }),
    );
  });
});
