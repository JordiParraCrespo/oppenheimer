import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { sniffSessionImage } from '@oppenheimer/shared';
import type {
  SessionDispatchOutcome,
  SessionDispatchPort,
} from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { PasteSessionImageCommand } from './paste-session-image.command';

/**
 * Hands an image to a session's window: the runner saves it on the host and
 * pastes its path into the prompt, because the agent reads its host's
 * clipboard and never the browser's (05).
 *
 * **Nothing is appended.** A pasted image is input, like a keystroke, and
 * input is not a log entry; what the reader sees is the path in the prompt.
 * A runner that refuses the image is the one thing worth writing down, and
 * the relay writes its `command.failed` when it comes back.
 *
 * The type is what the bytes say, not what the browser labelled them, and a
 * session that cannot take the image — closed, or stopped with no pane to
 * paste into — is refused here rather than sent a file it would throw away.
 */
@CommandHandler(PasteSessionImageCommand)
export class PasteSessionImageCommandHandler
  implements ICommandHandler<PasteSessionImageCommand, SessionDispatchOutcome>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: PasteSessionImageCommand): Promise<SessionDispatchOutcome> {
    const mediaType = sniffSessionImage(command.data);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail: 'The file is not a PNG, JPEG, GIF or WebP image.',
      });
    }

    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }
    if (session.stoppedAt) {
      throw new AppError(SessionErrors.NOT_RUNNING, {
        detail: `Session ${session.slug} is stopped; restart it to paste into its prompt`,
      });
    }

    return this.dispatch.pasteImage(session, {
      window: command.window,
      mediaType,
      data: command.data,
    });
  }
}
