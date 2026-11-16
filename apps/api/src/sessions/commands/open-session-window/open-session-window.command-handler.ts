import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { OpenedSessionWindowResponse } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionWindowsPort } from '../../application/session-windows.port';
import { changedOrThrow } from '../../application/session-windows-refusal.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_WINDOWS } from '../../sessions.di-tokens';
import { OpenSessionWindowCommand } from './open-session-window.command';

/**
 * Opens a plain shell in the session's worktree, a new tmux window, or with
 * `agent` a second coding agent started there, and answers with its index so
 * the Terminal tab can mint an attach ticket for it. Nothing is stored: the
 * host is the record of a session's windows, and window 0 stays the session's
 * agent.
 *
 * Owner only, through the workspace scope: a share guest never gets past
 * window 0.
 */
@CommandHandler(OpenSessionWindowCommand)
export class OpenSessionWindowCommandHandler
  implements ICommandHandler<OpenSessionWindowCommand, OpenedSessionWindowResponse>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_WINDOWS)
    private readonly windows: SessionWindowsPort,
  ) {}

  async execute(command: OpenSessionWindowCommand): Promise<OpenedSessionWindowResponse> {
    const session = await this.loader.requireLiveOnHost(command.scope, command.sessionId);
    await this.hosts.assertUsable(command.scope, session.hostId);
    const { windows, opened } = changedOrThrow(
      await this.windows.open(session.hostId, session.id, command.agent),
      session.hostId,
    );
    const window = windows.find((candidate) => candidate.index === opened);
    if (!window) {
      // The runner said it opened a window and then did not list it: the
      // shell or the agent exited at once. There is nothing to attach to.
      throw new AppError(SessionErrors.WINDOW_REFUSED, {
        detail: 'The host opened a terminal that closed at once',
      });
    }
    return { window, windows };
  }
}
