import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { RunnerEventAck } from '../../application/record-session-events.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { NameSessionCommand } from '../name-session/name-session.command';
import { RecordSessionEventsCommand } from './record-session-events.command';

/**
 * Writes a runner's batch into a session's log, folds it onto the row, and answers
 * what is now durable.
 *
 * It has no controller: the batch arrives over the runner link, so the module that
 * owns that link dispatches this. What makes it safe to expose that way is here
 * rather than in the transport — the session is loaded by id and **checked against
 * the host that presented the credential**, so a host cannot write into somebody
 * else's log, and the payload cap and the `seq` allocation are the repository's.
 *
 * A refusal is per row, not per batch. An event the log will never accept is
 * reported as rejected so the runner stops resending it; everything else is
 * accepted, and a key in neither list means the batch was not accounted for and
 * should be sent again.
 */
@CommandHandler(RecordSessionEventsCommand)
export class RecordSessionEventsCommandHandler
  implements ICommandHandler<RecordSessionEventsCommand, RunnerEventAck>
{
  private readonly logger = new Logger(RecordSessionEventsCommandHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RecordSessionEventsCommand): Promise<RunnerEventAck> {
    const found = await this.sessions.findOneByIdForMachine(command.sessionId);
    // A session this host does not hold is refused per key rather than by throwing:
    // the runner must learn to stop resending, and an error would have it retry for
    // ever. The two cases answer alike so a host cannot probe for session ids.
    if (found.isNone() || found.unwrap().hostId !== command.hostId) {
      return {
        batchId: command.batchId,
        accepted: [],
        rejected: command.events.map((event) => ({
          idempotencyKey: event.idempotencyKey,
          reason: 'no such session on this host',
        })),
      };
    }

    const session = found.unwrap();
    const outcome = await this.sessions.appendEvents(
      session,
      command.events.map((event) => ({
        idempotencyKey: event.idempotencyKey,
        source: 'runner' as const,
        kind: event.kind,
        // The wire carries the payload as a JSON string so the 8 KB cap survives
        // into the generated Go. It is parsed here, at the boundary, and stored as
        // jsonb; a payload that is not JSON is kept verbatim rather than dropped.
        payload: parsePayload(event.payload),
        occurredAt: new Date(event.occurredAt),
      })),
    );

    this.nameFromFirstPrompt(
      command,
      outcome.appended.map((event) => event.kind),
    );
    return { batchId: command.batchId, accepted: outcome.accepted, rejected: outcome.rejected };
  }

  /**
   * The first prompt is what names a session. It is dispatched rather than awaited:
   * naming talks to somebody's inference API, and a runner's acknowledgement must
   * not wait on that — or fail because of it.
   */
  private nameFromFirstPrompt(command: RecordSessionEventsCommand, kinds: string[]): void {
    if (!kinds.includes(SESSION_EVENT_KINDS.PROMPT_FIRST)) return;
    this.commandBus
      .execute(new NameSessionCommand({ sessionId: command.sessionId }))
      .catch((error: Error) =>
        this.logger.warn(`Naming session ${command.sessionId} failed: ${error.message}`),
      );
  }
}

/** The wire's JSON string, as an object. Anything else is kept as the text it was. */
function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}
