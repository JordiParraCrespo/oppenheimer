import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { CloudRunsPort } from '../../../../cloud-agents/application/cloud-runs.port';
import { CloudAgentErrors } from '../../../../cloud-agents/domain/cloud-agents.errors';
import { CloudFollowUpResolver } from '../../../application/cloud-follow-up.resolver';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import { SessionPromptTyperResolver } from '../../../application/session-prompt-typer.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCloudRunEntity } from '../../../domain/session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { SendSessionPromptCommand } from '../../send-session-prompt/send-session-prompt.command';
import { SendSessionPromptCommandHandler } from '../send-session-prompt.command-handler';

/**
 * A bot's follow-up prompt reaches the agent as the keys the chat view types
 * for a message, only while the agent waits at its prompt: it is claimed in
 * the log first, with the sender the API read, so a racing prompt is
 * refused; and a prompt whose keys did not reach the host is marked
 * undelivered rather than left looking sent.
 *
 * A cloud session Cursor runs takes the prompt as a new run of its agent,
 * claimed the same way, sent on its launcher's key only, never while a run is
 * on, and marked undelivered when the vendor refuses it. One a host started
 * at its vendor (Claude Code's) takes none here and says where to answer it.
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

/** A claim that won: the `prompt.sent` row it appended. */
const APPENDED = { accepted: [], rejected: [], appended: [{ seq: 3 }] };

/** `claims` is whether the conditional append wins the row (another prompt may have first). */
function harness(
  session: WorkSessionEntity,
  delivered = true,
  claims = true,
  followUp: CloudRunsPort['followUp'] = async () => ({
    runId: 'run-2',
    status: 'running',
    branch: null,
    pullRequestUrl: null,
    summary: null,
  }),
) {
  const sessions = {
    findOneById: vi.fn().mockResolvedValue(Some(session)),
    appendEvents: vi.fn().mockResolvedValue(APPENDED),
    saveCloudRunIf: vi.fn().mockResolvedValue(true),
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
  const runs = { launch: vi.fn(), read: vi.fn(), followUp: vi.fn(followUp) };
  const handler = new SendSessionPromptCommandHandler(
    new SessionLoaderResolver(sessions),
    new SessionPromptTyperResolver(sessions, dispatch),
    new CloudFollowUpResolver(runs, sessions),
  );
  return { handler, sessions, dispatch, runs };
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

  describe('a cloud session Cursor runs', () => {
    /** A Cursor session whose last run is in `status`, folded the way a sync folds it. */
    function cursorSession(status: 'finished' | 'running', createdBy = 'user-1') {
      const session = WorkSessionEntity.requestCloud({
        id: 'cloud-1',
        cloudRun: SessionCloudRunEntity.launched(
          {
            organizationId: 'org-acme',
            sessionId: 'cloud-1',
            provider: 'cursor',
            externalId: 'bc-cloud-1',
            url: 'https://cursor.com/agents/bc-cloud-1',
            repositoryUrl: 'https://github.com/acme/api',
            run: { runId: 'run-1', status, branch: null, pullRequestUrl: null, summary: null },
          },
          new Date(),
        ),
        organizationId: 'org-acme',
        projectId: 'project-1',
        createdByUserId: createdBy,
        slug: 'bold-otter-3f9a7k',
        agent: 'cursor',
      });
      session.recordEvents([
        { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: new Date() },
        {
          seq: 2,
          kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
          payload: { state: status === 'running' ? 'working' : 'done' },
          occurredAt: new Date(),
        },
      ]);
      return session;
    }

    it("claims the prompt, sends it as a new run on the launcher's key, and follows that run", async () => {
      const session = cursorSession('finished');
      const { handler, sessions, runs, dispatch } = harness(session);

      const result = await handler.execute(prompt(session));

      expect(result).toMatchObject({ sessionId: 'cloud-1', seq: 3 });
      expect(sessions.appendEventsIf).toHaveBeenCalledWith(
        session,
        [
          expect.objectContaining({
            kind: 'prompt.sent',
            payload: { text: 'Now run the tests', sender: SENDER },
          }),
        ],
        expect.any(Function),
      );
      expect(runs.followUp).toHaveBeenCalledWith(
        { organizationId: 'org-acme', userId: 'user-1' },
        'cursor',
        'bc-cloud-1',
        'Now run the tests',
      );
      expect(vi.mocked(sessions.appendEventsIf).mock.invocationCallOrder[0]).toBeLessThan(
        runs.followUp.mock.invocationCallOrder[0],
      );
      // The run row moves to the new run only from the one it was read on.
      expect(sessions.saveCloudRunIf).toHaveBeenCalledWith(
        expect.objectContaining({ latestRunId: 'run-2', status: 'running' }),
        'run-1',
      );
      expect(sessions.appendEvents).toHaveBeenCalledWith(session, [
        expect.objectContaining({ idempotencyKey: 'cloud:run-2:started' }),
        expect.objectContaining({ idempotencyKey: 'cloud:run-2:observed:working' }),
      ]);
      expect(dispatch.typeKeys).not.toHaveBeenCalled();
    });

    // Nothing is queued behind a busy agent: the vendor would refuse it, and a
    // prompt held for later would land in a run nobody is watching.
    it('refuses with SESSIONS_036 while its last run is on, claiming and sending nothing', async () => {
      const session = cursorSession('running');
      const { handler, sessions, runs } = harness(session);
      await expect(handler.execute(prompt(session))).rejects.toMatchObject({
        code: 'SESSIONS_036',
      });
      expect(sessions.appendEventsIf).not.toHaveBeenCalled();
      expect(runs.followUp).not.toHaveBeenCalled();
    });

    it('marks the prompt undelivered and answers the vendor’s code when it is busy after all', async () => {
      const session = cursorSession('finished');
      const { handler, sessions } = harness(session, true, true, async () => {
        throw new AppError(CloudAgentErrors.AGENT_BUSY, { detail: 'Cursor: busy' });
      });
      await expect(handler.execute(prompt(session))).rejects.toMatchObject({
        code: 'CLOUD_AGENTS_012',
      });
      expect(sessions.appendEvents).toHaveBeenCalledWith(session, [
        expect.objectContaining({ kind: 'prompt.undelivered' }),
      ]);
      expect(sessions.saveCloudRunIf).not.toHaveBeenCalled();
    });

    // The vendor bills its launcher's key: nobody else's credential may spend it.
    it('refuses anyone but its launcher with SESSIONS_050, claiming and sending nothing', async () => {
      const session = cursorSession('finished', 'user-2');
      const { handler, sessions, runs } = harness(session);
      await expect(handler.execute(prompt(session))).rejects.toMatchObject({
        code: 'SESSIONS_050',
      });
      expect(sessions.appendEventsIf).not.toHaveBeenCalled();
      expect(runs.followUp).not.toHaveBeenCalled();
    });

    it('refuses a closed one with SESSIONS_005', async () => {
      const session = cursorSession('finished');
      session.recordEvents([
        { seq: 3, kind: SESSION_EVENT_KINDS.CLOSED, payload: {}, occurredAt: new Date() },
      ]);
      const { handler, runs } = harness(session);
      await expect(handler.execute(prompt(session))).rejects.toMatchObject({
        code: 'SESSIONS_005',
      });
      expect(runs.followUp).not.toHaveBeenCalled();
    });
  });

  it('refuses a Claude Code cloud session with SESSIONS_038 and names where to answer it', async () => {
    const session = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'calm-heron-1a2b3c',
      agent: 'claude-code',
      place: 'cloud',
    });
    session.recordEvents([
      {
        seq: 1,
        kind: SESSION_EVENT_KINDS.STARTED,
        payload: { agentSessionId: 'session_01Abc' },
        occurredAt: new Date(),
      },
    ]);
    const { handler, sessions, dispatch, runs } = harness(session);
    await expect(handler.execute(prompt(session))).rejects.toMatchObject({
      code: 'SESSIONS_038',
      detail: expect.stringContaining('https://claude.ai/code/session_01Abc'),
    });
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
    expect(runs.followUp).not.toHaveBeenCalled();
  });
});
