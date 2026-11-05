import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type {
  HostTranscriptPage,
  SessionTranscriptOutcome,
  SessionTranscriptPort,
} from '../../../application/session-transcript.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCloudRunEntity } from '../../../domain/session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { FindSessionTranscriptQuery } from '../find-session-transcript.query';
import { FindSessionTranscriptQueryHandler } from '../find-session-transcript.query-handler';

/**
 * A reader's page of a session's conversation (`agent-tools.md` §8): the
 * session is read in the caller's scope before anything is asked of a host,
 * a cloud session's host is never asked (its conversation is at the vendor),
 * what comes back has its secrets taken out, its cursor continues where the
 * host said, and every way of not reading says so instead of an empty page.
 * The wire is the relay adapter's spec; the runner's half is
 * `apps/runner/internal/cli/link_transcript_test.go`.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function hostSession(): WorkSessionEntity {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
}

function line(blocks: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'u-1',
    timestamp: '2026-11-05T10:00:00.000Z',
    message: { role: 'assistant', content: blocks },
    ...extra,
  });
}

function page(over: Partial<HostTranscriptPage> = {}): HostTranscriptPage {
  return {
    conversation: 'c4b1e09a7f2d3e65',
    entries: [line([{ type: 'text', text: 'Tests pass.' }])],
    from: 0,
    next: 120,
    atEnd: true,
    ...over,
  };
}

describe('FindSessionTranscriptQueryHandler', () => {
  let outcome: SessionTranscriptOutcome;
  let transcripts: { read: ReturnType<typeof vi.fn<SessionTranscriptPort['read']>> };
  let found: WorkSessionEntity | null;
  let handler: FindSessionTranscriptQueryHandler;

  beforeEach(() => {
    found = hostSession();
    outcome = { kind: 'page', page: page() };
    const sessions = {
      findOneById: vi.fn(async () => (found ? Some(found) : None)),
    } as unknown as WorkSessionRepositoryPort;
    transcripts = { read: vi.fn<SessionTranscriptPort['read']>(async () => outcome) };
    handler = new FindSessionTranscriptQueryHandler(
      new SessionLoaderResolver(sessions),
      transcripts,
    );
  });

  const read = (props: { cursor?: string; limit?: number } = {}) =>
    handler.execute(
      new FindSessionTranscriptQuery({
        scope: SCOPE,
        sessionId: found?.id ?? '00000000-0000-4000-8000-000000000000',
        limit: props.limit ?? 50,
        cursor: props.cursor,
      }),
    );

  // The regression: a session outside the caller's scope (another workspace's)
  // answered, or merely asked of its host, because the id was guessed.
  it('answers a session outside the caller’s scope as not found and asks no host', async () => {
    found = null;
    await expect(read()).rejects.toMatchObject({ code: 'SESSIONS_001' });
    expect(transcripts.read).not.toHaveBeenCalled();
  });

  it("reads the latest turns from the session's own host and hands back a cursor that continues them", async () => {
    const first = await read({ limit: 20 });
    expect(transcripts.read).toHaveBeenCalledWith('host-1', found?.id, { limit: 20 });
    expect(first).toMatchObject({
      status: 'complete',
      reason: null,
      atEnd: true,
      entries: [
        {
          id: 'u-1',
          role: 'assistant',
          at: '2026-11-05T10:00:00.000Z',
          parts: [{ kind: 'text', text: 'Tests pass.', truncated: false }],
        },
      ],
    });

    await read({ cursor: first.nextCursor ?? undefined, limit: 20 });
    expect(transcripts.read).toHaveBeenLastCalledWith('host-1', found?.id, {
      limit: 20,
      conversation: 'c4b1e09a7f2d3e65',
      after: 120,
    });
  });

  // A secret a tool printed must not reach a bot's model provider or a script.
  it('replaces secrets in every part before the page leaves, and counts them', async () => {
    const toolResult = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            content: `GITHUB_TOKEN=ghp_${'a'.repeat(36)}\nOPENAI_API_KEY=sk-proj-${'b'.repeat(40)}`,
          },
        ],
      },
    });
    outcome = {
      kind: 'page',
      page: page({
        entries: [
          line([{ type: 'tool_use', name: 'Bash', input: { command: 'env' } }]),
          toolResult,
        ],
      }),
    };
    const result = await read();
    const text = JSON.stringify(result.entries);
    expect(text).not.toContain('ghp_');
    expect(text).not.toContain('sk-proj-');
    expect(result.redactions).toBeGreaterThanOrEqual(2);
    expect(result.entries[0]?.parts[0]).toMatchObject({ kind: 'tool_call', tool: 'Bash' });
  });

  it('calls a page partial when the host cut a part or left entries out', async () => {
    outcome = {
      kind: 'page',
      page: page({ entries: [line([{ type: 'text', text: 'long…', truncated: true }])] }),
    };
    await expect(read()).resolves.toMatchObject({ status: 'partial' });
    outcome = { kind: 'page', page: page({ dropped: 2 }) };
    await expect(read()).resolves.toMatchObject({ status: 'partial', dropped: 2 });
  });

  it('leaves out lines that are not messages instead of failing the page', async () => {
    outcome = {
      kind: 'page',
      page: page({
        entries: ['not json', '{"type":"status"}', line([{ type: 'text', text: 'ok' }])],
      }),
    };
    const result = await read();
    expect(result.entries).toHaveLength(1);
  });

  // The regression: a cloud session's host asked about a conversation it never
  // had, or an empty page passed off as a complete one.
  it.each([
    [
      'a Claude Code cloud session its host started',
      () => {
        const session = WorkSessionEntity.request({
          organizationId: 'org-acme',
          projectId: 'project-1',
          createdByUserId: 'user-1',
          hostId: 'host-1',
          slug: 'calm-heron-1a2b3c',
          agent: 'claude-code',
          place: 'cloud',
        });
        session.recordEvent({
          seq: 2,
          kind: SESSION_EVENT_KINDS.STARTED,
          payload: { agentSessionId: 'session_01Abc' },
          occurredAt: new Date(),
        });
        return session;
      },
      'https://claude.ai/code/session_01Abc',
    ],
    [
      'a Cursor session launched at its vendor',
      () =>
        WorkSessionEntity.requestCloud({
          id: '7f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40',
          organizationId: 'org-acme',
          projectId: 'project-1',
          createdByUserId: 'user-1',
          slug: 'calm-heron-1a2b3c',
          agent: 'cursor',
          cloudRun: SessionCloudRunEntity.launched(
            {
              organizationId: 'org-acme',
              sessionId: '7f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40',
              provider: 'cursor',
              externalId: 'bc-7f0d',
              url: 'https://cursor.com/agents/bc-7f0d',
              repositoryUrl: 'https://github.com/acme/web',
              run: {
                runId: 'run-1',
                status: 'running',
                branch: null,
                pullRequestUrl: null,
                summary: null,
              },
            },
            new Date(),
          ),
        }),
      'https://cursor.com/agents/bc-7f0d',
    ],
  ])(
    'answers %s as unsupported, with where to read it, and asks no host',
    async (_name, make, vendorUrl) => {
      found = make();
      const result = await read();
      expect(result).toMatchObject({
        status: 'unsupported',
        reason: 'cloud_vendor',
        vendorUrl,
        entries: [],
        nextCursor: null,
      });
      expect(transcripts.read).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ kind: 'host_offline' } as const, 'unavailable', 'host_offline'],
    [{ kind: 'timed_out' } as const, 'unavailable', 'timed_out'],
    [{ kind: 'not_supported' } as const, 'unsupported', 'runner_too_old'],
    [{ kind: 'failed', code: 'SESS_018' } as const, 'unsupported', 'agent_keeps_none'],
    [{ kind: 'failed', code: 'SESS_001' } as const, 'unavailable', 'host_refused'],
  ])('says why nothing was read when the host answers %o', async (answer, status, reason) => {
    outcome = answer;
    await expect(read()).resolves.toMatchObject({ status, reason, entries: [], nextCursor: null });
  });

  it('refuses a cursor this API did not mint with SESSIONS_049 and asks no host', async () => {
    await expect(read({ cursor: 'made-up' })).rejects.toMatchObject({ code: 'SESSIONS_049' });
    expect(transcripts.read).not.toHaveBeenCalled();
  });
});
