import { heyApiSdk } from '@oppenheimer/api-client';
import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsRepository, toCreateSessionRequest } from '../sessions.repository';

vi.mock('@oppenheimer/api-client', () => ({
  heyApiSdk: {
    findSessions: vi.fn(),
    findSessionEvents: vi.fn(),
    closeSession: vi.fn(),
    answerSessionDecision: vi.fn(),
  },
}));

/** What the generated SDK resolves to on success. */
const ok = (data: unknown) => ({ data, response: { status: 200 } }) as never;

function session(id: string) {
  return {
    id,
    organizationId: 'org-1',
    projectId: 'project-1',
    hostId: 'host-1',
    name: id,
    slug: 'bold-otter-a1b2c3',
    agent: 'claude-code',
    launch: { model: null, permission: 'ask', effort: null },
    state: 'working',
    lifecycle: 'open',
    cwdCheckoutId: null,
    agentSessionId: null,
    lastEventAt: null,
    stoppedAt: null,
    place: 'worktree',
    folderPath: null,
    checkouts: [],
    hints: [],
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
  };
}

const page = (ids: string[], nextCursor: string | null, extra: object = {}) =>
  ok({ data: ids.map(session), meta: { limit: 100, nextCursor, ...extra } });

describe('SessionsRepository.findAll', () => {
  let repository: SessionsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SessionsRepository();
  });

  it('follows nextCursor until it is null, and never asks for a page number', async () => {
    vi.mocked(heyApiSdk.findSessions)
      .mockResolvedValueOnce(page(['s1', 's2'], 'c1', { total: 5, page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(page(['s3', 's4'], 'c2'))
      .mockResolvedValueOnce(page(['s5'], null));

    const sessions = await repository.findAll();

    expect(sessions.map((each) => each.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(vi.mocked(heyApiSdk.findSessions).mock.calls.map(([options]) => options?.query)).toEqual(
      [{ limit: 100 }, { limit: 100, cursor: 'c1' }, { limit: 100, cursor: 'c2' }],
    );
  });

  it('stops after one request when the first page is the last', async () => {
    vi.mocked(heyApiSdk.findSessions).mockResolvedValueOnce(page([], null));
    await expect(repository.findAll()).resolves.toEqual([]);
    expect(heyApiSdk.findSessions).toHaveBeenCalledTimes(1);
  });

  it('treats an absent body as a failed read, not an empty list', async () => {
    vi.mocked(heyApiSdk.findSessions).mockResolvedValue(ok(undefined));

    const error = await repository.findAll().catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SESSIONS_CLIENT_001');
  });
});

/**
 * The API takes a close for a host that is offline and keeps it owed, sending
 * it again when the host reconnects. Refusing it here was right while nothing
 * re-sent it; now it would tell the reader a delete failed that is on its way.
 */
describe('SessionsRepository.close', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers a close that has not reached its host yet with the close owed', async () => {
    vi.mocked(heyApiSdk.closeSession).mockResolvedValue(
      ok({
        ...session('s1'),
        hints: ['host_offline'],
        closeRequest: { requestedAt: '2026-10-18T12:00:00Z', acceptUnpushedWork: false },
      }),
    );

    const closed = await new SessionsRepository().close('s1');

    expect(closed.isHostOffline).toBe(true);
    expect(closed.isClosing).toBe(true);
  });

  it('answers the row of a close its host was sent', async () => {
    vi.mocked(heyApiSdk.closeSession).mockResolvedValue(ok(session('s1')));
    await expect(new SessionsRepository().close('s1')).resolves.toMatchObject({ id: 's1' });
  });
});

describe('SessionsRepository.findStartLog', () => {
  const stepEntry = (seq: number, step: string, status: string) => ({
    seq,
    kind: 'session.step',
    payload: { step, status },
  });

  beforeEach(() => vi.clearAllMocks());

  it('reads past session.started, which is the pane, and stops at the agent step', async () => {
    vi.mocked(heyApiSdk.findSessionEvents)
      .mockResolvedValueOnce(
        ok({
          data: [
            stepEntry(1, 'host', 'done'),
            { seq: 2, kind: 'session.started', payload: {} },
            stepEntry(3, 'clone', 'done'),
          ],
          nextSeq: 3,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          data: [stepEntry(4, 'worktree', 'done'), stepEntry(5, 'agent', 'done')],
          nextSeq: 6,
        }),
      );

    const entries = await new SessionsRepository().findStartLog('s1');

    expect(entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
    // The agent step settled it: no third page is asked for.
    expect(heyApiSdk.findSessionEvents).toHaveBeenCalledTimes(2);
  });
});

/**
 * A session runs in its checkouts or in a folder, never both
 * (`product/versions/mvp/24-session-places.md`): the API refuses a body that
 * carries the two, so a folder create must not grow an empty `checkouts`.
 */
describe('toCreateSessionRequest', () => {
  it('sends a folder session with its folder and no checkouts', () => {
    expect(
      toCreateSessionRequest({ hostId: 'host-1', agent: 'shell', folder: '/home/jordi' }),
    ).toEqual({ hostId: 'host-1', agent: 'shell', folder: '/home/jordi' });
  });

  it('sends a worktree session with its checkouts and no folder', () => {
    const body = toCreateSessionRequest({
      hostId: 'host-1',
      agent: 'claude-code',
      checkouts: [{ installationId: 'inst-1', githubRepoId: 42 }],
      prompt: 'Fix it',
    });

    expect(body).toEqual({
      hostId: 'host-1',
      agent: 'claude-code',
      checkouts: [{ installationId: 'inst-1', githubRepoId: 42 }],
      prompt: 'Fix it',
    });
    expect(body).not.toHaveProperty('folder');
  });
});

/**
 * A session's pending decision (`29-inbox.md` slice 4) reaches the console as
 * the API states it, with what the runner left out read as null, and an
 * answer goes to the decision route as the body the API takes.
 */
describe('SessionsRepository decisions', () => {
  let repository: SessionsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SessionsRepository();
  });

  it('reads a question with its absent header and descriptions as null', async () => {
    vi.mocked(heyApiSdk.findSessions).mockResolvedValueOnce(
      ok({
        data: [
          {
            ...session('s1'),
            decision: {
              kind: 'question',
              id: 'toolu_1',
              questions: [
                {
                  question: 'Which screens?',
                  multiSelect: true,
                  options: [{ label: 'Wallet' }, { label: 'All', description: 'Every tab' }],
                },
              ],
            },
          },
          session('s2'),
        ],
        meta: { limit: 100, nextCursor: null },
      }),
    );

    const [asked, quiet] = await repository.findAll();

    expect(asked?.decision).toEqual({
      kind: 'question',
      id: 'toolu_1',
      questions: [
        {
          header: null,
          question: 'Which screens?',
          multiSelect: true,
          options: [
            { label: 'Wallet', description: null },
            { label: 'All', description: 'Every tab' },
          ],
        },
      ],
    });
    expect(quiet?.decision).toBeNull();
  });

  it('answers a permission by its option and returns the session the API answers', async () => {
    vi.mocked(heyApiSdk.answerSessionDecision).mockResolvedValueOnce(ok(session('s1')));

    const answered = await repository.answerDecision('s1', { id: 'perm-a', option: 0 });

    expect(answered.id).toBe('s1');
    expect(heyApiSdk.answerSessionDecision).toHaveBeenCalledWith({
      path: { id: 's1' },
      body: { id: 'perm-a', option: 0 },
    });
  });
});
