import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type {
  RunnerEventAck,
  RunnerSessionEvent,
} from '../../application/record-session-events.port';
import { SessionNamingResolver } from '../../application/session-naming.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RecordSessionEventsCommand } from './record-session-events.command';

/**
 * Writes a runner's batch into a session's log, folds it onto the row, and answers
 * what is now durable.
 *
 * It has no controller: the batch arrives over the runner link. What makes that
 * safe is here rather than in the transport — the session is **checked against the
 * host that presented the credential** — and the payload cap and the `seq`
 * allocation are the repository's.
 *
 * A refusal is per row, not per batch: an event the log will never accept is
 * rejected so the runner stops resending it, and a key in neither list means the
 * batch was not accounted for and should be sent again.
 */
@CommandHandler(RecordSessionEventsCommand)
export class RecordSessionEventsCommandHandler
  implements ICommandHandler<RecordSessionEventsCommand, RunnerEventAck>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly naming: SessionNamingResolver,
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

    // The wire carries each payload as a JSON string, so the 8 KB cap survives into
    // the generated Go. It is parsed here, at the boundary, and stored as jsonb.
    const session = found.unwrap();
    const outcome = await this.sessions.appendEvents(session, command.events.map(toAppend));

    // Not awaited: naming talks to somebody's inference API, and a runner's
    // acknowledgement must not wait on that — or fail because of it.
    void this.naming.nameFromPrompt(session, outcome.appended);
    return { batchId: command.batchId, accepted: outcome.accepted, rejected: outcome.rejected };
  }
}

/** One wire event as the log takes it. `seq` is the control plane's, so it is absent. */
function toAppend(event: RunnerSessionEvent) {
  return {
    idempotencyKey: event.idempotencyKey,
    source: 'runner' as const,
    kind: event.kind,
    payload: parsePayload(event.payload),
    occurredAt: new Date(event.occurredAt),
  };
}

/** The wire's JSON string, as an object. Anything else is kept as the text it was. */
function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}
