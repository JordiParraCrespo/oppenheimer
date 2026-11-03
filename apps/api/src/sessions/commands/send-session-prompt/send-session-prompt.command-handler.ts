import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { requireOnHost, SessionLoaderResolver } from '../../application/session-loader.resolver';
import { SessionPromptTyperResolver } from '../../application/session-prompt-typer.resolver';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SessionErrors } from '../../domain/sessions.errors';
import { SendSessionPromptCommand } from './send-session-prompt.command';

/**
 * Types a follow-up prompt into a running session's agent for a bot (issue
 * #493), the keys the console's chat view types for a message, sent to
 * window 0 as `session.input`. The claim and the keys are
 * `SessionPromptTyperResolver`'s; this command reads the session as the bot's
 * owner and turns what it came to into the errors a bot's tool reads.
 *
 * No controller: a person types into the terminal itself. A bot's tool sends
 * a prompt this way, and a wake (`DeliverSessionWakeCommand`) shares the typer.
 */
@CommandHandler(SendSessionPromptCommand)
export class SendSessionPromptCommandHandler
  implements ICommandHandler<SendSessionPromptCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    private readonly typer: SessionPromptTyperResolver,
  ) {}

  async execute(command: SendSessionPromptCommand): Promise<SessionCommandResult> {
    const session = requireOnHost(await this.loader.find(command.scope, command.sessionId));
    const refusal = session.inputRefusal;
    if (refusal) {
      throw new AppError(refusal, { detail: `Session ${session.slug} cannot take input` });
    }
    const typed = await this.typer.type(session, {
      commandId: command.id,
      text: command.text,
      sender: command.sender,
    });
    switch (typed.outcome) {
      case 'not-ready':
        throw new AppError(SessionErrors.AGENT_NOT_AT_PROMPT, { detail: typed.reason });
      case 'undelivered':
        throw new AppError(SessionErrors.HOST_OFFLINE, {
          detail: 'The prompt was not sent: send it again once the host is online.',
        });
      case 'claimed-before':
        return { sessionId: session.id, hints: [] };
      case 'typed':
        return { sessionId: session.id, hints: [], seq: typed.seq };
    }
  }
}
