import { heyApiSdk } from '@oppenheimer/api-client';
import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsRepository } from '../sessions.repository';

vi.mock('@oppenheimer/api-client', () => ({
  heyApiSdk: { listSessions: vi.fn() },
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
    vi.mocked(heyApiSdk.listSessions)
      .mockResolvedValueOnce(page(['s1', 's2'], 'c1', { total: 5, page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(page(['s3', 's4'], 'c2'))
      .mockResolvedValueOnce(page(['s5'], null));

    const sessions = await repository.findAll();

    expect(sessions.map((each) => each.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(vi.mocked(heyApiSdk.listSessions).mock.calls.map(([options]) => options?.query)).toEqual(
      [{ limit: 100 }, { limit: 100, cursor: 'c1' }, { limit: 100, cursor: 'c2' }],
    );
  });

  it('stops after one request when the first page is the last', async () => {
    vi.mocked(heyApiSdk.listSessions).mockResolvedValueOnce(page([], null));
    await expect(repository.findAll()).resolves.toEqual([]);
    expect(heyApiSdk.listSessions).toHaveBeenCalledTimes(1);
  });

  it('treats an absent body as a failed read, not an empty list', async () => {
    vi.mocked(heyApiSdk.listSessions).mockResolvedValue(ok(undefined));

    const error = await repository.findAll().catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SESSIONS_CLIENT_001');
  });
});
