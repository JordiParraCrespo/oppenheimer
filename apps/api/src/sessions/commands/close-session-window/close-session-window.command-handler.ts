import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ClosedSessionWindowResponse } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionWindowsPort } from '../../application/session-windows.port';
import { changedOrThrow } from '../../application/session-windows-refusal.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_WINDOWS } from '../../sessions.di-tokens';
import { CloseSessionWindowCommand } from './close-session-window.command';

/**
 * Closes one of the session's shells and answers with the windows left. The
 * agent's window 0 is refused here (`SESSIONS_057`) before the host is asked:
 * it ends with the session, never as a tab. The runner refuses it too.
 */
@CommandHandler(CloseSessionWindowCommand)
export class CloseSessionWindowCommandHandler
  implements ICommandHandler<CloseSessionWindowCommand, ClosedSessionWindowResponse>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_WINDOWS)
    private readonly windows: SessionWindowsPort,
  ) {}

  async execute(command: CloseSessionWindowCommand): Promise<ClosedSessionWindowResponse> {
    if (command.window === 0) {
      throw new AppError(SessionErrors.WINDOW_IS_AGENT, {
        detail: 'Window 0 is the agent; close the session instead',
      });
    }
    if (command.window < 0) {
      throw new AppError(SessionErrors.WINDOW_NOT_FOUND, {
        detail: `No window ${command.window}`,
      });
    }
    const session = await this.loader.requireLiveOnHost(command.scope, command.sessionId);
    await this.hosts.assertUsable(command.scope, session.hostId);
    const { windows } = changedOrThrow(
      await this.windows.close(session.hostId, session.id, command.window),
      session.hostId,
    );
    return { windows };
  }
}
