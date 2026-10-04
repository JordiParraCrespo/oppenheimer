import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { isSessionImageType, sniffSessionFile } from '@oppenheimer/shared/protocol';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_DISPATCH } from '../../sessions.di-tokens';
import { PasteSessionImageCommand } from './paste-session-image.command';

/**
 * Hands a file (an image, a PDF, text) to a session's window: the runner pulls it, saves it on the host and
 * pastes its path into the prompt, because the agent reads its host's clipboard, never
 * the browser's (05).
 *
 * **Nothing is appended**: a pasted image is input, like a keystroke. A runner's
 * refusal is the one thing worth writing down, and the relay writes its
 * `command.failed` when it comes back.
 *
 * Order matters: the bytes are judged before the session is read, the session before
 * anything is parked, and a host that cannot take the file (offline, or a runner that
 * predates it or its type) is an error rather than an accepted paste that will never land.
 */
@CommandHandler(PasteSessionImageCommand)
export class PasteSessionImageCommandHandler
  implements ICommandHandler<PasteSessionImageCommand, void>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: PasteSessionImageCommand): Promise<void> {
    const mediaType = sniffSessionFile(command.data, command.hint);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail:
          'Attach an image, a PDF, or a UTF-8 text file; executables, archives, scripts, SVG and HTML are refused.',
      });
    }

    const session = await this.loader.find(command.scope, command.sessionId);
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
        detail: isSessionImageType(mediaType)
          ? 'Update the runner on this session’s host to paste images into it.'
          : 'Update the runner on this session’s host to give it PDFs and text files.',
      });
    }
    throw new AppError(SessionErrors.HOST_OFFLINE, {
      detail: 'Nothing was sent: the file is not kept for a host that comes back.',
    });
  }
}
