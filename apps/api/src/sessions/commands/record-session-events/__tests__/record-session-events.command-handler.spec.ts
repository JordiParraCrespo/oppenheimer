import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionNamingResolver } from '../../../application/session-naming.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import type { WorkSessionEntity } from '../../../domain/work-session.entity';
import { RecordSessionEventsCommand } from '../record-session-events.command';
import { RecordSessionEventsCommandHandler } from '../record-session-events.command-handler';

const events = [
  {
    idempotencyKey: 'run-1:1',
    kind: 'prompt.first',
    payload: '{"text":"add dark mode"}',
    occurredAt: '2026-09-28T10:00:00.000Z',
  },
  {
    idempotencyKey: 'run-1:2',
    kind: 'agent.observed',
    payload: 'not json',
    occurredAt: '2026-09-28T10:00:01.000Z',
  },
];

function setup(appended: Awaited<ReturnType<WorkSessionRepositoryPort['appendEventsForHost']>>) {
  const sessions = {
    appendEventsForHost: vi.fn().mockResolvedValue(appended),
    findOneByIdForMachine: vi.fn(),
    appendEvents: vi.fn(),
  };
  const naming = { nameFromPrompt: vi.fn().mockResolvedValue(undefined) };
  const handler = new RecordSessionEventsCommandHandler(
    sessions as unknown as WorkSessionRepositoryPort,
    naming as unknown as SessionNamingResolver,
  );
  const command = new RecordSessionEventsCommand({
    batchId: 'b1',
    sessionId: 's1',
    hostId: 'h1',
    events,
  });
  return { sessions, naming, handler, command };
}

describe('RecordSessionEventsCommandHandler', () => {
  it('appends through the host path, with nothing read before the transaction', async () => {
    const session = { id: 's1' } as WorkSessionEntity;
    const outcome = { accepted: ['run-1:1', 'run-1:2'], rejected: [], appended: [] };
    const { sessions, naming, handler, command } = setup(Some({ session, outcome }));

    await expect(handler.execute(command)).resolves.toEqual({
      batchId: 'b1',
      accepted: ['run-1:1', 'run-1:2'],
      rejected: [],
    });
    expect(sessions.findOneByIdForMachine).not.toHaveBeenCalled();
    expect(sessions.appendEvents).not.toHaveBeenCalled();
    const [hostId, sessionId, appended] = sessions.appendEventsForHost.mock.calls[0];
    expect([hostId, sessionId]).toEqual(['h1', 's1']);
    expect(appended).toEqual([
      expect.objectContaining({ source: 'runner', payload: { text: 'add dark mode' } }),
      expect.objectContaining({ source: 'runner', payload: { raw: 'not json' } }),
    ]);
    // Naming is handed the session the append built from the locked row.
    expect(naming.nameFromPrompt).toHaveBeenCalledWith(session, []);
  });

  it('rejects every key, the same way, when the session is missing or on another host', async () => {
    const { naming, handler, command } = setup(None);
    await expect(handler.execute(command)).resolves.toEqual({
      batchId: 'b1',
      accepted: [],
      rejected: [
        { idempotencyKey: 'run-1:1', reason: 'no such session on this host' },
        { idempotencyKey: 'run-1:2', reason: 'no such session on this host' },
      ],
    });
    expect(naming.nameFromPrompt).not.toHaveBeenCalled();
  });
});
