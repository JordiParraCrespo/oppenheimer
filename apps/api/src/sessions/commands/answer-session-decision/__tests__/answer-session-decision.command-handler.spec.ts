import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { AnswerSessionDecisionCommand } from '../answer-session-decision.command';
import { AnswerSessionDecisionCommandHandler } from '../answer-session-decision.command-handler';

/**
 * An answer from the Inbox reaches the agent as the keys a person would type,
 * and only for the decision the session waits on now: a stale or ill-fitting
 * answer is refused before a key is sent, and nothing is recorded for keys
 * that did not reach the host.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const DOWN = '\u001b[B';

const option = (label: string) => ({ label, description: null });
const QUESTION = {
  kind: 'question' as const,
  id: 'toolu_01',
  questions: [
    {
      header: 'Scope',
      question: 'What should it cover?',
      multiSelect: false,
      options: [option('Tokens'), option('Components'), option('Everything')],
    },
  ],
};
const MULTI = {
  kind: 'question' as const,
  id: 'toolu_02',
  questions: [
    {
      header: null,
      question: 'Which platforms?',
      multiSelect: true,
      options: [option('Web'), option('iOS'), option('Android')],
    },
  ],
};
const PERMISSION = {
  kind: 'permission' as const,
  id: 'perm-1',
  title: 'Do you want to proceed?',
  detail: 'pnpm test',
  options: [{ label: 'Yes' }, { label: 'Yes, always' }, { label: 'No' }],
};

function waitingOn(decision: unknown) {
  const session = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  session.recordEvents([
    { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: new Date() },
    {
      seq: 2,
      kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
      payload: { state: 'blocked' },
      occurredAt: new Date(),
    },
    {
      seq: 3,
      kind: SESSION_EVENT_KINDS.AGENT_DECISION,
      payload: { decision },
      occurredAt: new Date(),
    },
  ]);
  return session;
}

function harness(session: WorkSessionEntity, delivered = true) {
  const sessions = {
    findOneById: vi.fn().mockResolvedValue(Some(session)),
    appendEvents: vi.fn().mockResolvedValue({ accepted: [], rejected: [], appended: [] }),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    typeKeys: vi
      .fn()
      .mockResolvedValue(
        delivered ? { delivered, hints: [] } : { delivered, hints: ['host_offline'] },
      ),
  } as unknown as SessionDispatchPort;
  const handler = new AnswerSessionDecisionCommandHandler(
    new SessionLoaderResolver(sessions),
    sessions,
    dispatch,
  );
  return { handler, sessions, dispatch };
}

const answer = (session: WorkSessionEntity, body: AnswerSessionDecisionCommand['answer']) =>
  new AnswerSessionDecisionCommand({ scope: SCOPE, sessionId: session.id, answer: body });

const typed = (dispatch: SessionDispatchPort) =>
  vi.mocked(dispatch.typeKeys).mock.calls[0]?.[1].keys;

describe('AnswerSessionDecisionCommandHandler', () => {
  it('types a single choice’s number into window 0 and records the answer', async () => {
    const session = waitingOn(QUESTION);
    const { handler, dispatch, sessions } = harness(session);

    await handler.execute(
      answer(session, { id: 'toolu_01', answers: [{ picks: [2], other: null }] }),
    );

    expect(dispatch.typeKeys).toHaveBeenCalledWith(session, {
      window: 0,
      keys: ['3'],
      gapMs: 120,
    });
    expect(sessions.appendEvents).toHaveBeenCalledWith(session, [
      expect.objectContaining({ kind: 'decision.answered', payload: { id: 'toolu_01' } }),
    ]);
  });

  it('types words of the person’s own on the row after the options', async () => {
    const session = waitingOn(QUESTION);
    const { handler, dispatch } = harness(session);
    await handler.execute(
      answer(session, { id: 'toolu_01', answers: [{ picks: [], other: 'Icons' }] }),
    );
    expect(typed(dispatch)).toEqual(['4', 'Icons', '\r']);
  });

  it('ticks several, walks to Submit and sends the review', async () => {
    const session = waitingOn(MULTI);
    const { handler, dispatch } = harness(session);
    await handler.execute(
      answer(session, { id: 'toolu_02', answers: [{ picks: [0, 2], other: null }] }),
    );
    expect(typed(dispatch)).toEqual(['1', '3', DOWN, DOWN, DOWN, DOWN, '\r', '1']);
  });

  it('answers a permission dialog with its option’s number', async () => {
    const session = waitingOn(PERMISSION);
    const { handler, dispatch } = harness(session);
    await handler.execute(answer(session, { id: 'perm-1', option: 1 }));
    expect(typed(dispatch)).toEqual(['2']);
  });

  it('refuses an answer to a decision that is no longer pending with SESSIONS_032', async () => {
    const session = waitingOn(PERMISSION);
    const { handler, dispatch, sessions } = harness(session);
    await expect(
      handler.execute(answer(session, { id: 'perm-0', option: 0 })),
    ).rejects.toMatchObject({
      code: 'SESSIONS_032',
    });
    const idle = waitingOn(null);
    await expect(
      harness(idle).handler.execute(answer(idle, { id: 'perm-1', option: 0 })),
    ).rejects.toMatchObject({ code: 'SESSIONS_032' });
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });

  it.each([
    ['an option the dialog lacks', PERMISSION, { id: 'perm-1', option: 3 }],
    ['answers to a dialog', PERMISSION, { id: 'perm-1', answers: [{ picks: [0], other: null }] }],
    [
      'two picks for one choice',
      QUESTION,
      { id: 'toolu_01', answers: [{ picks: [0, 1], other: null }] },
    ],
    [
      'a pick and words for one choice',
      QUESTION,
      { id: 'toolu_01', answers: [{ picks: [0], other: 'x' }] },
    ],
    ['no answer at all', MULTI, { id: 'toolu_02', answers: [{ picks: [], other: '  ' }] }],
    ['a pick past the options', MULTI, { id: 'toolu_02', answers: [{ picks: [3], other: null }] }],
    [
      'answers for two questions',
      QUESTION,
      {
        id: 'toolu_01',
        answers: [
          { picks: [0], other: null },
          { picks: [0], other: null },
        ],
      },
    ],
  ])('refuses %s with SESSIONS_033, typing nothing', async (_, decision, body) => {
    const session = waitingOn(decision);
    const { handler, dispatch } = harness(session);
    await expect(handler.execute(answer(session, body))).rejects.toMatchObject({
      code: 'SESSIONS_033',
    });
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
  });

  it('answers SESSIONS_034 for a host with no link, and leaves the decision pending', async () => {
    const session = waitingOn(PERMISSION);
    const { handler, sessions } = harness(session, false);
    await expect(
      handler.execute(answer(session, { id: 'perm-1', option: 0 })),
    ).rejects.toMatchObject({
      code: 'SESSIONS_034',
    });
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });
});
