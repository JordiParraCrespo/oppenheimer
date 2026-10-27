import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import {
  PROMPT_SUBMIT_GAP_MS,
  promptKeys,
  promptRefusal,
} from '../../domain/session-prompt.policy';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { SendSessionPromptCommand } from './send-session-prompt.command';

/** The agent's window, where its prompt is drawn. */
const AGENT_WINDOW = 0;

/**
 * Types a follow-up prompt into a running session's agent for a bot (issue
 * #493), the keys the console's chat view types for a message, sent to
 * window 0 as `session.input`.
 *
 * The prompt is claimed first, as `prompt.sent` appended only while the agent
 * still waits at its prompt, with the sender as the API read it: the log, not
 * the words, says who spoke, and of two prompts sent at once one types and
 * the other is refused. The keys go after the claim; a host that cannot take
 * them gets `prompt.undelivered`, which cancels the turn the claim opened.
 *
 * No controller: a person types into the terminal itself. Only a bot's
 * tool sends a prompt this way.
 */
@CommandHandler(SendSessionPromptCommand)
export class SendSessionPromptCommandHandler
  implements ICommandHandler<SendSessionPromptCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: SendSessionPromptCommand): Promise<SessionCommandResult> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const refusal = session.inputRefusal;
    if (refusal) {
      throw new AppError(refusal, { detail: `Session ${session.slug} cannot take input` });
    }
    const notReady = promptRefusal(session.fold);
    if (notReady) throw new AppError(SessionErrors.AGENT_NOT_AT_PROMPT, { detail: notReady });

    const claimed = await this.sessions.appendEventsIf(
      session,
      [
        this.entry(command, SESSION_EVENT_KINDS.PROMPT_SENT, {
          text: command.text,
          sender: command.sender,
        }),
      ],
      (fold) => promptRefusal(fold) === null,
    );
    if (!claimed) {
      throw new AppError(SessionErrors.AGENT_NOT_AT_PROMPT, {
        detail: 'The agent moved on before the prompt could be sent.',
      });
    }

    const { delivered } = await this.dispatch.typeKeys(session, {
      window: AGENT_WINDOW,
      keys: promptKeys(command.text),
      gapMs: PROMPT_SUBMIT_GAP_MS,
    });
    if (!delivered) {
      await this.sessions.appendEvents(session, [
        this.entry(command, SESSION_EVENT_KINDS.PROMPT_UNDELIVERED, { id: command.id }),
      ]);
      throw new AppError(SessionErrors.HOST_OFFLINE, {
        detail: 'The prompt was not sent: send it again once the host is online.',
      });
    }
    return { sessionId: session.id, hints: [] };
  }

  private entry(command: SendSessionPromptCommand, kind: string, payload: unknown) {
    return {
      idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, kind),
      source: 'api' as const,
      kind,
      payload,
    };
  }
}
