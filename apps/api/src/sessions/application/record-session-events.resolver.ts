import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RecordSessionEventsCommand } from '../commands/record-session-events/record-session-events.command';
import type {
  RecordSessionEventsPort,
  RunnerEventAck,
  RunnerEventBatch,
} from './record-session-events.port';

/**
 * The published door onto the log for the module that owns the runner link.
 *
 * It is a port rather than a bare command so the relay depends on a typed method
 * with a documented contract instead of on which slice happens to handle a message
 * — the shape of the batch and the shape of the acknowledgement are the wire's, and
 * they are what the relay has to get right.
 */
@Injectable()
export class RecordSessionEventsResolver implements RecordSessionEventsPort {
  constructor(private readonly commandBus: CommandBus) {}

  async record(batch: RunnerEventBatch): Promise<RunnerEventAck> {
    return this.commandBus.execute<RecordSessionEventsCommand, RunnerEventAck>(
      new RecordSessionEventsCommand({
        batchId: batch.batchId,
        sessionId: batch.sessionId,
        hostId: batch.hostId,
        events: batch.events,
      }),
    );
  }
}
