import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { SessionLoaderResolver } from '../application/session-loader.resolver';
import type {
  SessionWindowOpenOutcome,
  SessionWindowsPort,
} from '../application/session-windows.port';
import { CloseSessionWindowCommand } from '../commands/close-session-window/close-session-window.command';
import { CloseSessionWindowCommandHandler } from '../commands/close-session-window/close-session-window.command-handler';
import { OpenSessionWindowCommand } from '../commands/open-session-window/open-session-window.command';
import { OpenSessionWindowCommandHandler } from '../commands/open-session-window/open-session-window.command-handler';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { FindSessionWindowsQuery } from '../queries/find-session-windows/find-session-windows.query';
import { FindSessionWindowsQueryHandler } from '../queries/find-session-windows/find-session-windows.query-handler';

/**
 * The Terminal tab's three calls, at the handlers: each asks the session's own
 * host about this session, marks window 0 as the agent's, and maps a host
 * that cannot answer onto a documented problem. Reading draws an offline host
 * as a state, like the Browser tab's ports; opening or closing refuses. The
 * agent's window is never sent to the host to close.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('session window handlers', () => {
  let outcome: SessionWindowOpenOutcome;
  let windows: {
    list: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let work: WorkSessionEntity;
  let loader: SessionLoaderResolver;
  let hosts: HostAccessPort;

  beforeEach(() => {
    work = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
    });
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
    } as unknown as WorkSessionRepositoryPort;
    windows = {
      list: vi.fn(async () => outcome),
      open: vi.fn(async () => outcome),
      close: vi.fn(async () => outcome),
    };
    loader = new SessionLoaderResolver(sessions);
    hosts = { assertUsable: vi.fn().mockResolvedValue({}) } as unknown as HostAccessPort;
  });

  const port = () => windows as unknown as SessionWindowsPort;
  const list = () =>
    new FindSessionWindowsQueryHandler(loader, hosts, port()).execute(
      new FindSessionWindowsQuery({ scope: SCOPE, sessionId: work.id }),
    );
  const open = (agent?: 'codex') =>
    new OpenSessionWindowCommandHandler(loader, hosts, port()).execute(
      new OpenSessionWindowCommand({ scope: SCOPE, sessionId: work.id, agent }),
    );
  const close = (window: number) =>
    new CloseSessionWindowCommandHandler(loader, hosts, port()).execute(
      new CloseSessionWindowCommand({ scope: SCOPE, sessionId: work.id, window }),
    );

  it("lists the session's windows from its own host, window 0 the agent's", async () => {
    outcome = { kind: 'listed', windows: [{ index: 0, name: 'claude' }, { index: 1 }] };

    await expect(list()).resolves.toEqual({
      state: 'listed',
      windows: [
        { index: 0, name: 'claude', agent: true },
        { index: 1, name: 'shell', agent: false },
      ],
    });
    expect(windows.list).toHaveBeenCalledWith('host-1', work.id);
  });

  it('reads an offline host or an old runner as a state, and no answer as SESSIONS_031', async () => {
    outcome = { kind: 'host_offline' };
    await expect(list()).resolves.toEqual({ state: 'host_offline', windows: [] });
    outcome = { kind: 'not_supported' };
    await expect(list()).resolves.toEqual({ state: 'not_supported', windows: [] });
    outcome = { kind: 'timed_out' };
    await expect(list()).rejects.toMatchObject({ code: 'SESSIONS_031' });
  });

  it('answers an open with the window it made, so the tab can attach to it', async () => {
    outcome = {
      kind: 'listed',
      windows: [
        { index: 0, name: 'claude' },
        { index: 3, name: 'zsh' },
      ],
      opened: 3,
    };

    await expect(open()).resolves.toEqual({
      window: { index: 3, name: 'zsh', agent: false },
      windows: [
        { index: 0, name: 'claude', agent: true },
        { index: 3, name: 'zsh', agent: false },
      ],
    });
    expect(windows.open).toHaveBeenCalledWith('host-1', work.id, undefined);
  });

  it('asks the host for the second agent an open names, and answers with its window', async () => {
    outcome = {
      kind: 'listed',
      windows: [
        { index: 0, name: 'claude' },
        { index: 2, name: 'codex' },
      ],
      opened: 2,
    };

    await expect(open('codex')).resolves.toMatchObject({
      window: { index: 2, name: 'codex', agent: false },
    });
    expect(windows.open).toHaveBeenCalledWith('host-1', work.id, 'codex');
  });

  it('refuses a second agent on a runner that cannot start one with SESSIONS_060', async () => {
    outcome = { kind: 'agent_not_supported' };
    await expect(open('codex')).rejects.toMatchObject({ code: 'SESSIONS_060' });
  });

  it('refuses an open or a close the host could not take, each with its own code', async () => {
    outcome = { kind: 'host_offline' };
    await expect(open()).rejects.toMatchObject({ code: 'SESSIONS_016' });
    outcome = { kind: 'not_supported' };
    await expect(open()).rejects.toMatchObject({ code: 'SESSIONS_056' });
    outcome = { kind: 'timed_out' };
    await expect(close(2)).rejects.toMatchObject({ code: 'SESSIONS_031' });
    outcome = { kind: 'failed', code: 'SESS_001' };
    await expect(close(2)).rejects.toMatchObject({ code: 'SESSIONS_058' });
    outcome = { kind: 'failed', code: 'SESS_003' };
    await expect(close(2)).rejects.toMatchObject({ code: 'SESSIONS_059' });
  });

  it("closes a shell and answers with the windows left; the agent's is refused before the host is asked", async () => {
    outcome = { kind: 'listed', windows: [{ index: 0, name: 'claude' }] };
    await expect(close(1)).resolves.toEqual({
      windows: [{ index: 0, name: 'claude', agent: true }],
    });
    expect(windows.close).toHaveBeenCalledWith('host-1', work.id, 1);

    windows.close.mockClear();
    await expect(close(0)).rejects.toMatchObject({ code: 'SESSIONS_057' });
    expect(windows.close).not.toHaveBeenCalled();
  });
});
