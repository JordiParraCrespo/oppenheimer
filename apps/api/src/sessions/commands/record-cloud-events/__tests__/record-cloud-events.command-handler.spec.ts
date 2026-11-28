import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { SessionCloudChatRepositoryPort } from '../../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { RecordCloudEventsCommand } from '../record-cloud-events.command';
import { RecordCloudEventsCommandHandler } from '../record-cloud-events.command-handler';

/**
 * What the extension's events become: the chat of a session this workspace
 * knows, or of one it adopts from claude.ai, but never of one the person
 * closed here or of a cloud session whose chat lives elsewhere.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const CLOUD_ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';
const EVENTS = [{ id: 'e1', line: '{"type":"user","uuid":"e1"}' }];

function cloudSession(agent: 'claude-code' | 'codex' = 'claude-code'): WorkSessionEntity {
  const session = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent,
    place: 'cloud',
  });
  session.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.STARTED,
    payload: { agentSessionId: CLOUD_ID, checkouts: [] },
    occurredAt: new Date(),
  });
  return session;
}

describe('RecordCloudEventsCommandHandler', () => {
  let sessions: {
    findCloudByCloudIds: ReturnType<typeof vi.fn>;
    createIfUnclaimed: ReturnType<typeof vi.fn>;
  };
  let chat: { appendEvents: ReturnType<typeof vi.fn> };
  let handler: RecordCloudEventsCommandHandler;

  const record = (title?: string) =>
    handler.execute(
      new RecordCloudEventsCommand({
        scope: SCOPE,
        userId: 'user-1',
        cloudSessionId: CLOUD_ID,
        title,
        events: EVENTS,
      }),
    );

  beforeEach(() => {
    sessions = {
      findCloudByCloudIds: vi.fn().mockResolvedValue([]),
      hasCloudSessionFor: vi.fn().mockResolvedValue(false),
      createIfUnclaimed: vi.fn().mockImplementation(async (session: WorkSessionEntity) => ({
        session,
        created: true,
        refused: null,
      })),
    };
    chat = { appendEvents: vi.fn().mockResolvedValue(1) };
    const plan = {
      resolveProject: vi.fn().mockResolvedValue({ id: 'unassigned-1', slug: 'unassigned' }),
    };
    handler = new RecordCloudEventsCommandHandler(
      sessions as unknown as WorkSessionRepositoryPort,
      chat as unknown as SessionCloudChatRepositoryPort,
      plan as unknown as SessionPlanFactory,
    );
  });

  it('keeps the events of a session this workspace already follows, adopting nothing', async () => {
    const known = cloudSession();
    sessions.findCloudByCloudIds.mockResolvedValue([known]);
    expect(await record()).toEqual({ sessionId: known.id, accepted: 1 });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    expect(chat.appendEvents).toHaveBeenCalledWith('org-acme', known.id, EVENTS, undefined);
  });

  it('adopts a session started on claude.ai: hostless, claude-code, named after its title, keyed on its id', async () => {
    const result = await record('Fix the login page');
    const [adopted, entries] = sessions.createIfUnclaimed.mock.calls[0] as [
      WorkSessionEntity,
      { kind: string; payload: Record<string, unknown> }[],
    ];
    // Breaks if an adopted session is filed under a host, as another agent,
    // under a generated name, or without the key that adopts it once.
    expect(adopted).toMatchObject({
      hostId: null,
      agent: 'claude-code',
      place: 'cloud',
      name: 'Fix the login page',
    });
    expect(adopted.idempotencyKey).toBe(`claude-cloud:${CLOUD_ID}`);
    // Breaks if the start does not carry the claude.ai id every cloud read finds it by.
    expect(entries.map((entry) => entry.kind)).toEqual([
      SESSION_EVENT_KINDS.REQUESTED,
      SESSION_EVENT_KINDS.STARTED,
    ]);
    expect(entries[1].payload).toMatchObject({ agentSessionId: CLOUD_ID });
    expect(result).toEqual({ sessionId: adopted.id, accepted: 1 });
  });

  it('keeps nothing for a session the person closed here', async () => {
    const closed = cloudSession();
    vi.spyOn(closed, 'state', 'get').mockReturnValue('resolved');
    sessions.createIfUnclaimed.mockResolvedValue({
      session: closed,
      created: false,
      refused: null,
    });
    // Breaks if closing a session in the console is undone by the next read of claude.ai.
    expect(await record()).toEqual({ sessionId: null, accepted: 0 });
    expect(chat.appendEvents).not.toHaveBeenCalled();
  });

  it('neither keeps nor adopts again a session launched here and closed', async () => {
    // The open-sessions read misses a closed one; the any-state lookup finds it.
    sessions.hasCloudSessionFor.mockResolvedValue(true);
    // Breaks if closing a console-launched cloud session makes the next read
    // of claude.ai adopt it as a second session.
    expect(await record()).toEqual({ sessionId: null, accepted: 0 });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    expect(chat.appendEvents).not.toHaveBeenCalled();
  });

  it('refuses events for a cloud session whose chat is not Claude Code’s', async () => {
    sessions.findCloudByCloudIds.mockResolvedValue([cloudSession('codex')]);
    await expect(record()).rejects.toMatchObject({ code: 'SESSIONS_054' });
    expect(chat.appendEvents).not.toHaveBeenCalled();
  });
});
