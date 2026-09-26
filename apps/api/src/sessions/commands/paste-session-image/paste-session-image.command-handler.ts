import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { sniffSessionImage } from '@oppenheimer/shared/protocol';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { PasteSessionImageCommand } from './paste-session-image.command';

/**
 * Hands an image to a session's window: the runner pulls it, saves it on the
 * host and pastes its path into the prompt, because the agent reads its
 * host's clipboard and never the browser's (05).
 *
 * **Nothing is appended.** A pasted image is input, like a keystroke, and
 * input is not a log entry; what the reader sees is the path in the prompt. A
 * runner that refuses the image is the one thing worth writing down, and the
 * relay writes its `command.failed` when it comes back.
 *
 * The order is the point: the bytes are judged before the session is read,
 * the session before anything is parked, and a host that cannot take the
 * image — offline, or a runner that predates it — is an error rather than an
 * accepted paste that will never land.
 */
@CommandHandler(PasteSessionImageCommand)
export class PasteSessionImageCommandHandler
  implements ICommandHandler<PasteSessionImageCommand, void>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: PasteSessionImageCommand): Promise<void> {
    const mediaType = sniffSessionImage(command.data);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail: 'The file is not one of the image types a session takes.',
      });
    }

    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    const refusal = session.inputRefusal;
    if (refusal) {
      throw new AppError(refusal, { detail: `Session ${session.slug} cannot take input` });
    }

    const { delivered, hints } = await this.dispatch.pasteImage(session, {
      window: command.window,
      mediaType,
      data: command.data,
    });
    if (delivered) return;
    if (hints.includes('not_supported')) {
      throw new AppError(SessionErrors.HOST_CANNOT_TAKE_IMAGES, {
        detail: 'Update the runner on this session’s host to paste images into it.',
      });
    }
    throw new AppError(SessionErrors.HOST_OFFLINE, {
      detail: 'Nothing was sent: the image is not kept for a host that comes back.',
    });
  }
}
