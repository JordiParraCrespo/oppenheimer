import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnpairHostCommand } from '../../hosts/commands/unpair-host/unpair-host.command';
import { FindHostsQuery } from '../../hosts/queries/find-hosts/find-hosts.query';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import { FindSessionsQuery } from '../../sessions/queries/find-sessions/find-sessions.query';
import { WorkspaceShutdownGateway } from '../infrastructure/workspace-shutdown.gateway';

describe('WorkspaceShutdownGateway', () => {
  let commandBus: { execute: ReturnType<typeof vi.fn> };
  let queryBus: { execute: ReturnType<typeof vi.fn> };
  let gateway: WorkspaceShutdownGateway;

  beforeEach(() => {
    commandBus = { execute: vi.fn().mockResolvedValue(undefined) };
    queryBus = {
      execute: vi.fn().mockImplementation(async (query) => {
        if (query instanceof FindSessionsQuery) {
          return { data: query.state === 'open' ? [{ id: 'session-1' }] : [] };
        }
        if (query instanceof FindHostsQuery) {
          return [
            { host: { id: 'host-1', isUnpaired: false }, online: true },
            { host: { id: 'host-2', isUnpaired: true }, online: false },
          ];
        }
        throw new Error('unexpected query');
      }),
    };
    gateway = new WorkspaceShutdownGateway(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
  });

  it('stops every live session of each workspace, scoped to that workspace alone', async () => {
    await gateway.stopSessions('user-uuid', ['org-1']);

    const states = queryBus.execute.mock.calls.map(([query]) => (query as FindSessionsQuery).state);
    expect(states).toEqual(['starting', 'open']);
    const stop = commandBus.execute.mock.calls[0][0] as StopSessionCommand;
    expect(stop).toBeInstanceOf(StopSessionCommand);
    expect(stop.sessionId).toBe('session-1');
    // Never a bypassing scope: a platform admin's request scope skips tenancy,
    // and stopping "every session" through it would stop everybody's.
    expect(stop.scope).toMatchObject({
      userId: 'user-uuid',
      organizationId: 'org-1',
      bypass: false,
    });
  });

  it('unpairs the hosts still paired, by owner', async () => {
    await gateway.unpairHosts('user-uuid');

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const unpair = commandBus.execute.mock.calls[0][0] as UnpairHostCommand;
    expect(unpair).toBeInstanceOf(UnpairHostCommand);
    expect(unpair.hostId).toBe('host-1');
    expect(unpair.scope).toMatchObject({ userId: 'user-uuid', bypass: false });
  });

  it('carries on when a host cannot be reached', async () => {
    commandBus.execute = vi.fn().mockRejectedValue(new Error('host offline'));

    await expect(gateway.stopSessions('user-uuid', ['org-1'])).resolves.toBeUndefined();
    await expect(gateway.unpairHosts('user-uuid')).resolves.toBeUndefined();
  });
});
