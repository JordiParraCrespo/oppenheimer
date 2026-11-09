import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { SessionTerminalPort } from '../../../application/session-terminal.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { DriveSessionTerminalCommand } from '../drive-session-terminal.command';
import { DriveSessionTerminalCommandHandler } from '../drive-session-terminal.command-handler';

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function session(agent: 'shell' | 'claude-code'): WorkSessionEntity {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'calm-otter-3f9a7k',
    agent,
  });
}

function harness(found: WorkSessionEntity | null) {
  const sessions = {
    findOneById: vi.fn(async () => (found ? Some(found) : None)),
  } as unknown as WorkSessionRepositoryPort;
  const terminals = {
    drive: vi.fn<SessionTerminalPort['drive']>(async () => ({
      kind: 'screen' as const,
      screen: { screen: '$ ', matched: true, waitedMs: 5 },
    })),
  };
  const handler = new DriveSessionTerminalCommandHandler(
    new SessionLoaderResolver(sessions),
    terminals,
  );
  const drive = (sessionId: string) =>
    handler.execute(
      new DriveSessionTerminalCommand({
        scope: SCOPE,
        sessionId,
        request: { text: 'ls', waitSeconds: 1 },
      }),
    );
  return { terminals, drive };
}

describe('DriveSessionTerminalCommandHandler', () => {
  it('drives a blank terminal on its own host', async () => {
    const terminal = session('shell');
    const { terminals, drive } = harness(terminal);
    await expect(drive(terminal.id)).resolves.toMatchObject({ kind: 'screen' });
    expect(terminals.drive).toHaveBeenCalledWith(
      'host-1',
      terminal.id,
      { text: 'ls', waitSeconds: 1 },
      undefined,
    );
  });

  // A bot types commands into a shell it opened, never into a coding agent's
  // prompt, which has verbs of its own; the host is not asked.
  it('refuses a session running an agent without asking its host', async () => {
    const agent = session('claude-code');
    const { terminals, drive } = harness(agent);
    await expect(drive(agent.id)).resolves.toMatchObject({ kind: 'failed', code: 'EXEC_007' });
    expect(terminals.drive).not.toHaveBeenCalled();
  });

  // The session read is the authorization: one outside the caller's scope is
  // not found, and nothing is typed.
  it('types into no session the caller cannot see', async () => {
    const { terminals, drive } = harness(null);
    await expect(drive('00000000-0000-4000-8000-000000000000')).rejects.toThrow();
    expect(terminals.drive).not.toHaveBeenCalled();
  });
});
