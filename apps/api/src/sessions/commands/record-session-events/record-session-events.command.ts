import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { RunnerSessionEvent } from '../../application/record-session-events.port';

/**
 * A runner's batch for one session's log.
 *
 * There is no `AccessScope` on it, and that is deliberate: the writer is a machine
 * that proved its own identity, not a person. `hostId` is what the handler checks
 * the session against, which is the machine equivalent of a tenant clause — a host
 * may only write to sessions it was given.
 */
export class RecordSessionEventsCommand extends CommandBase {
  readonly batchId: string;
  readonly sessionId: string;
  readonly hostId: string;
  readonly events: RunnerSessionEvent[];

  constructor(props: CommandProps<RecordSessionEventsCommand>) {
    super(props);
    this.batchId = props.batchId;
    this.sessionId = props.sessionId;
    this.hostId = props.hostId;
    this.events = props.events;
  }
}
