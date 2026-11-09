import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CloudFollowUpResolver } from '../../application/cloud-follow-up.resolver';
import { requireOnHost, SessionLoaderResolver } from '../../application/session-loader.resolver';
import {
  SessionPromptTyperResolver,
  type TypedPrompt,
} from '../../application/session-prompt-typer.resolver';
import type { SessionCloudRunEntity } from '../../domain/session-cloud-run.entity';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SessionErrors } from '../../domain/sessions.errors';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SendSessionPromptCommand } from './send-session-prompt.command';

/**
 * Types a follow-up prompt into a running session's agent for a bot (issue
 * #493), the keys the console's chat view types for a message, sent to
 * window 0 as `session.input`. The claim and the keys are
 * `SessionPromptTyperResolver`'s; this command reads the session in the
 * caller's scope and turns what it came to into the errors the caller reads.
 *
 * A bot's tool sends a prompt this way, and so does `POST /sessions/{id}/prompt`
 * for a person not at the terminal (the `opp` CLI, an MCP client); a person
 * at the terminal types into it. A wake (`DeliverSessionWakeCommand`) shares
 * the typer.
 *
 * A cloud session a vendor runs through its API (Cursor's) takes the prompt
 * as a new run instead (`CloudFollowUpResolver`), on the key of the person
 * who launched it, so only they may send one. A cloud session a host started
 * (Claude Code's, Codex's) takes none here: its vendor has no supported API
 * for it, and the refusal says where to answer it.
 */
@CommandHandler(SendSessionPromptCommand)
export class SendSessionPromptCommandHandler
  implements ICommandHandler<SendSessionPromptCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    private readonly typer: SessionPromptTyperResolver,
    private readonly cloud: CloudFollowUpResolver,
  ) {}

  async execute(command: SendSessionPromptCommand): Promise<SessionCommandResult> {
    const found = await this.loader.find(command.scope, command.sessionId);
    const prompt = { commandId: command.id, text: command.text, sender: command.sender };
    const run = found.cloudRun;
    if (run) {
      return this.answer(found, await this.followUp(found, run, command, prompt));
    }
    const session = requireOnHost(found);
    const refusal = session.inputRefusal;
    if (refusal) {
      const where = session.vendorUrl ? `; answer it at ${session.vendorUrl}` : '';
      throw new AppError(refusal, { detail: `Session ${session.slug} cannot take input${where}` });
    }
    return this.answer(session, await this.typer.type(session, prompt));
  }

  private followUp(
    session: WorkSessionEntity,
    run: SessionCloudRunEntity,
    command: SendSessionPromptCommand,
    prompt: Parameters<CloudFollowUpResolver['send']>[2],
  ): Promise<TypedPrompt> {
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }
    if (command.scope.userId !== session.createdByUserId) {
      throw new AppError(SessionErrors.CLOUD_FOLLOW_UP_NOT_LAUNCHER, {
        detail: `Session ${session.slug} runs on its launcher's ${run.provider} key`,
      });
    }
    return this.cloud.send(session, run, prompt);
  }

  private answer(session: WorkSessionEntity, typed: TypedPrompt): SessionCommandResult {
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
