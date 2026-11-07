import { describe, expect, it } from 'vitest';
import {
  decodeTranscriptCursor,
  encodeTranscriptCursor,
  REDACTED,
  redactEntry,
  redactSecrets,
  transcriptPageStatus,
  transcriptReasonStatus,
  transcriptRefusalReason,
} from '../domain/session-transcript.policy';

/**
 * What a transcript page owes its reader before it leaves the API
 * (`product/next-steps/agent-tools.md` §8): no secret a tool printed, a cursor
 * nobody can forge into a read of another conversation's middle, and a status
 * that never calls a cut page complete.
 */
describe('redactSecrets', () => {
  // Each one is a real shape a tool prints: `env`, `cat .env`, `curl -v`, a
  // config file. The regression is any of them reaching a bot's model provider.
  it.each([
    ['an Oppenheimer API token', 'oppenheimer_pat_A1b2C3d4E5f6G7h8'],
    ['a pairing token', 'opr_reg_A1b2C3d4E5f6G7h8'],
    ['a GitHub token', `ghp_${'a'.repeat(36)}`],
    ['a fine-grained GitHub token', `github_pat_${'A1'.repeat(20)}`],
    ['an Anthropic key', `sk-ant-api03-${'x'.repeat(40)}`],
    ['an OpenAI project key', `sk-proj-${'y'.repeat(40)}`],
    ['a Stripe key', `sk_live_${'z'.repeat(24)}`],
    ['an AWS access key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['a Google API key', `AIza${'b'.repeat(35)}`],
    ['a Slack token', 'xoxb-1234567890-abcdefghij'],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N'],
  ])('replaces %s', (_name, secret) => {
    const { text, redactions } = redactSecrets(`found ${secret} in the output`);
    expect(text).toBe(`found ${REDACTED} in the output`);
    expect(redactions).toBe(1);
  });

  it('replaces a private key whole, and one cut off before its end', () => {
    const pem =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----';
    expect(redactSecrets(`key:\n${pem}\ndone`).text).toBe(`key:\n${REDACTED}\ndone`);
    expect(redactSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIEow').text).toBe(REDACTED);
  });

  // The value goes; what names it stays, so a reader still learns that the
  // agent read a .env with a database password in it.
  it('keeps what names a secret by its place and replaces only the value', () => {
    expect(redactSecrets('DATABASE_PASSWORD=hunter2hunter2').text).toBe(
      `DATABASE_PASSWORD=${REDACTED}`,
    );
    expect(redactSecrets('{"api_key": "abcd1234efgh"}').text).toBe(`{"api_key": "${REDACTED}"}`);
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnop1234').text).toBe(
      `Authorization: Bearer ${REDACTED}`,
    );
    // `curl -v` against an API on Basic auth (Cursor's own is), and a session cookie.
    expect(redactSecrets('> Authorization: Basic dXNlcjpzdXBlcnNlY3JldHBhc3N3b3Jk').text).toBe(
      `> Authorization: Basic ${REDACTED}`,
    );
    expect(redactSecrets('> Cookie: session=abcdef0123456789abcdef').text).toBe(
      `> Cookie: ${REDACTED}`,
    );
    expect(redactSecrets('< set-cookie: sid=0123456789abcdef; Path=/').text).toBe(
      `< set-cookie: ${REDACTED}`,
    );
    // The same headers as a program prints them: a header object, a JSON log.
    expect(redactSecrets(`headers: { cookie: 'sid=0123456789abcdef' }`).text).toBe(
      `headers: { cookie: '${REDACTED}' }`,
    );
    expect(redactSecrets('{"Cookie": "session=abcdef0123456789"}').text).toBe(
      `{"Cookie": "${REDACTED}"}`,
    );
    expect(redactSecrets('{"set-cookie":["sid=0123456789abcdef; Path=/"]}').text).toBe(
      `{"set-cookie":["${REDACTED}"]}`,
    );
    // The same inside a JSON string, where every quote is escaped.
    expect(redactSecrets('{"content":"{\\"password\\":\\"hunter2hunter2\\"}"}').text).toBe(
      `{"content":"{\\"password\\":\\"${REDACTED}\\"}"}`,
    );
    expect(redactSecrets('"{\\"Authorization\\": \\"Basic dXNlcjpwYXNzd29yZA==\\"}"').text).toBe(
      `"{\\"Authorization\\": \\"Basic ${REDACTED}\\"}"`,
    );
    expect(redactSecrets('postgres://app:s3cretpass@db:5432/app').text).toBe(
      `postgres://app:${REDACTED}@db:5432/app`,
    );
  });

  // Over-redaction would make a transcript useless to read; these are the
  // words an agent writes about secrets every day.
  it('leaves prose and short or empty assignments alone', () => {
    const prose =
      'I rotated the token and set PASSWORD_MIN=8. The API key is read from the environment; token = null until then.';
    expect(redactSecrets(prose)).toEqual({ text: prose, redactions: 0 });
  });

  it('redacts every text part of an entry and counts them', () => {
    const { entry, redactions } = redactEntry({
      id: 'a',
      at: null,
      role: 'assistant',
      parts: [
        {
          kind: 'tool_call',
          text: '{"command":"cat .env"}',
          tool: 'Bash',
          isError: false,
          truncated: false,
        },
        {
          kind: 'tool_result',
          text: `GITHUB_TOKEN=ghp_${'q'.repeat(36)}`,
          tool: null,
          isError: false,
          truncated: false,
        },
        { kind: 'image', text: null, tool: null, isError: false, truncated: false },
      ],
    });
    expect(entry.parts[1]?.text).not.toContain('ghp_');
    expect(entry.parts[0]?.text).toBe('{"command":"cat .env"}');
    expect(redactions).toBeGreaterThanOrEqual(1);
  });
});

describe('transcript cursor', () => {
  it('round-trips the conversation and offset it was minted with', () => {
    const cursor = encodeTranscriptCursor({ conversation: 'c4b1e09a7f2d3e65', after: 18_244 });
    expect(decodeTranscriptCursor(cursor)).toEqual({
      conversation: 'c4b1e09a7f2d3e65',
      after: 18_244,
    });
  });

  // A cursor is client input: one built by hand must not reach the host as a
  // path or a negative or fractional offset.
  it.each([
    ['garbage', 'not a cursor'],
    ['a path for a conversation', Buffer.from('../../etc/passwd:0').toString('base64url')],
    ['a negative offset', Buffer.from('abc:-1').toString('base64url')],
    ['a fractional offset', Buffer.from('abc:1.5').toString('base64url')],
    ['no conversation', Buffer.from(':12').toString('base64url')],
  ])('refuses %s', (_name, cursor) => {
    expect(decodeTranscriptCursor(cursor)).toBeNull();
  });
});

describe('transcriptPageStatus', () => {
  const part = (truncated: boolean) => ({
    kind: 'text' as const,
    text: 'x',
    tool: null,
    isError: false,
    truncated,
  });
  const entry = (truncated: boolean) => ({
    id: null,
    at: null,
    role: 'assistant' as const,
    parts: [part(truncated)],
  });

  it('is complete only when nothing in the range was cut, left out or read without context', () => {
    expect(transcriptPageStatus({ entries: [entry(false)], dropped: 0, partial: false })).toBe(
      'complete',
    );
    expect(transcriptPageStatus({ entries: [], dropped: 0, partial: false })).toBe('complete');
    expect(transcriptPageStatus({ entries: [entry(true)], dropped: 0, partial: false })).toBe(
      'partial',
    );
    expect(transcriptPageStatus({ entries: [entry(false)], dropped: 1, partial: false })).toBe(
      'partial',
    );
    expect(transcriptPageStatus({ entries: [entry(false)], dropped: 0, partial: true })).toBe(
      'partial',
    );
  });

  it('calls an agent with no transcript unsupported, and a refused read unavailable', () => {
    expect(transcriptRefusalReason('SESS_018')).toBe('agent_keeps_none');
    expect(transcriptReasonStatus('agent_keeps_none')).toBe('unsupported');
    expect(transcriptRefusalReason('SESS_001')).toBe('host_refused');
    expect(transcriptReasonStatus('host_refused')).toBe('unavailable');
    expect(transcriptReasonStatus('cloud_vendor')).toBe('unsupported');
    expect(transcriptReasonStatus('host_offline')).toBe('unavailable');
  });
});
