import { randomUUID } from 'node:crypto';
import { ArgumentNotProvidedException } from './exceptions';
import { RequestContextService } from './request-context.service';

export interface CommandMetadata {
  readonly correlationId: string;

  /** Causation id used to reconstruct execution order if needed. */
  readonly causationId?: string;

  /**
   * Epoch milliseconds when the command was constructed: `Date.now()` unless
   * the caller passes one.
   */
  readonly timestamp: number;
}

/**
 * A command's own fields, plus an optional id and the metadata a caller wants
 * to carry over (a handler passes its event's `correlationId`); the rest of
 * the metadata is filled in, as for a domain event.
 */
export type CommandProps<T> = Omit<T, 'id' | 'metadata'> & {
  id?: string;
  metadata?: Partial<CommandMetadata>;
};

/**
 * Base class for commands. A command is a state-changing intention dispatched
 * through the CQRS command bus to its handler.
 */
export class CommandBase {
  readonly id: string;

  readonly metadata: CommandMetadata;

  constructor(props: CommandProps<unknown>) {
    // Only a missing props object is a mistake. An empty one is a command
    // with no payload, and `Guard.isEmpty({})` is true, so guarding on it
    // refused every payload-free command.
    if (props === undefined || props === null) {
      throw new ArgumentNotProvidedException('Command props should not be empty');
    }
    this.id = props.id ?? randomUUID();
    this.metadata = {
      correlationId:
        props?.metadata?.correlationId ?? RequestContextService.getCorrelationId() ?? randomUUID(),
      causationId: props?.metadata?.causationId,
      timestamp: props?.metadata?.timestamp ?? Date.now(),
    };
  }
}
