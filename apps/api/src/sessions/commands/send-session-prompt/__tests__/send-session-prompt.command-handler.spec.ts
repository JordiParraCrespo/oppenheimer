import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCloudRunEntity } from '../../../domain/session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { SendSessionPromptCommand } from '../send-session-prompt.command';
import { SendSessionPromptCommandHandler } from '../send-session-prompt.command-handler';

/**
 * A bot's follow-up prompt reaches the agent as the keys the chat view types
 * for a message, only while the agent waits at its prompt: it is claimed in
 * the log first, with the sender the API read, so a racing prompt is
 * refused; and a prompt whose keys did not reach the host is marked
 * undelivered rather than left looking sent.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const SENDER = { kind: 'bot' as const, botId: 'bot-1', turnId: 'turn-1' };

/** A running session whose agent was last seen in `observed`. */
function sessionAt(observed: string | null) {
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
    ...(observed
      ? [
          {
            seq: 2,
            kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
            payload: { state: observed },
            occurredAt: new Date(),
          },
        ]
      : []),
  ]);
  return session;
}

const APPENDED = { accepted: [], rejected: [], appended: [] };

/** `claims` is whether the conditional append wins the row (another prompt may have first). */
function harness(session: WorkSessionEntity, delivered = true, claims = true) {
  const sessions = {
    findOneById: vi.fn().mockResolvedValue(Some(session)),
    appendEvents: vi.fn().mockResolvedValue(APPENDED),
    appendEventsIf: vi
      .fn()
      .mockImplementation(
        async (_session, _events, holds: (fold: unknown, turn: unknown) => boolean) =>
          claims && holds(session.fold, session.latestTurn) ? APPENDED : null,
      ),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    typeKeys: vi
      .fn()
      .mockResolvedValue(
        delivered ? { delivered, hints: [] } : { delivered, hints: ['host_offline'] },
      ),
  } as unknown as SessionDispatchPort;
  const handler = new SendSessionPromptCommandHandler(
    new SessionLoaderResolver(sessions),
    sessions,
    dispatch,
  );
  return { handler, sessions, dispatch };
}

const prompt = (session: WorkSessionEntity, text = 'Now run the tests') =>
  new SendSessionPromptCommand({ scope: SCOPE, sessionId: session.id, text, sender: SENDER });

describe('SendSessionPromptCommandHandler', () => {
  it('records the prompt with its sender, then types it and Enter into window 0', async () => {
    const session = sessionAt('idle');
    const { handler, dispatch, sessions } = harness(session);

    await handler.execute(prompt(session));

    expect(sessions.appendEventsIf).toHaveBeenCalledWith(
      session,
      [
        expect.objectContaining({
          source: 'api',
          kind: 'prompt.sent',
          payload: { text: 'Now run the tests', sender: SENDER },
        }),
      ],
      expect.any(Function),
    );
    expect(dispatch.typeKeys).toHaveBeenCalledWith(session, {
      window: 0,
      keys: ['Now run the tests', '\r'],
      gapMs: 60,
    });
    expect(vi.mocked(sessions.appendEventsIf).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(dispatch.typeKeys).mock.invocationCallOrder[0],
    );
  });

  it('pastes several lines as one bracketed paste, so a newline is not Enter', async () => {
    const session = sessionAt('done');
    const { handler, dispatch } = harness(session);
    await handler.execute(prompt(session, 'One\nTwo'));
    expect(vi.mocked(dispatch.typeKeys).mock.calls[0][1].keys).toEqual([
      '\u001b[200~One\nTwo\u001b[201~',
      '\r',
    ]);
  });

  it.each(['working', 'blocked'])(
    'refuses with SESSIONS_036 while the agent is %s, recording and typing nothing',
    async (observed) => {
      const session = sessionAt(observed);
      const { handler, dispatch, sessions } = harness(session);
      await expect(handler.execute(prompt(session))).rejects.toMatchObject({
        code: 'SESSIONS_036',
      });
      expect(sessions.appendEventsIf).not.toHaveBeenCalled();
      expect(dispatch.typeKeys).not.toHaveBeenCalled();
    },
  );

  it('refuses with SESSIONS_036 the prompt that loses the claim, typing nothing', async () => {
    const session = sessionAt('idle');
    const { handler, dispatch } = harness(session, true, false);
    await expect(handler.execute(prompt(session))).rejects.toMatchObject({
      code: 'SESSIONS_036',
    });
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
  });

  it('claims only while no other prompt waits to be taken, so two sent at once never both type', async () => {
    const session = sessionAt('idle');
    const { handler, sessions } = harness(session);
    await handler.execute(prompt(session));
    const holds = vi.mocked(sessions.appendEventsIf).mock.calls[0][2];
    const justSent = { seq: 1, origin: 'follow_up', state: 'queued' } as const;
    expect(holds({ ...session.fold, lastEventAt: new Date() }, null)).toBe(true);
    expect(holds({ ...session.fold, lastEventAt: new Date() }, { ...justSent } as never)).toBe(
      false,
    );
  });

  it('refuses a stopped session with SESSIONS_014', async () => {
    const session = sessionAt('idle');
    session.recordEvents([
      { seq: 3, kind: SESSION_EVENT_KINDS.STOPPED, payload: {}, occurredAt: new Date() },
    ]);
    const { handler, sessions } = harness(session);
    await expect(handler.execute(prompt(session))).rejects.toMatchObject({
      code: 'SESSIONS_014',
    });
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
  });

  it('refuses a cloud session with SESSIONS_039, recording and typing nothing', async () => {
    // Its agent waits at its vendor's prompt, not one on a host to type into.
    const session = WorkSessionEntity.requestCloud({
      id: 'cloud-1',
      cloudRun: SessionCloudRunEntity.launched(
        {
          organizationId: 'org-acme',
          sessionId: 'cloud-1',
          provider: 'cursor',
          externalId: 'bc-cloud-1',
          url: null,
          repositoryUrl: 'https://github.com/acme/api',
          run: {
            runId: 'run-1',
            status: 'finished',
            branch: null,
            pullRequestUrl: null,
            summary: null,
          },
        },
        new Date(),
      ),
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'cursor',
    });
    session.recordEvents([
      { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: new Date() },
      {
        seq: 2,
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'idle' },
        occurredAt: new Date(),
      },
    ]);
    const { handler, sessions, dispatch } = harness(session);
    await expect(handler.execute(prompt(session))).rejects.toMatchObject({
      code: 'SESSIONS_039',
    });
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
  });

  it('marks the prompt undelivered and answers SESSIONS_016 when the host cannot take the keys', async () => {
    const session = sessionAt('idle');
    const { handler, sessions } = harness(session, false);
    await expect(handler.execute(prompt(session))).rejects.toMatchObject({
      code: 'SESSIONS_016',
    });
    expect(sessions.appendEvents).toHaveBeenCalledWith(session, [
      expect.objectContaining({ kind: 'prompt.undelivered' }),
    ]);
  });
});
