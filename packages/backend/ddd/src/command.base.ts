import { randomUUID } from 'node:crypto';
import { ArgumentNotProvidedException } from './exceptions';
import { Guard } from './guard';
import { RequestContextService } from './request-context.service';

export interface CommandMetadata {
  /** Correlation id used for log correlation. */
  readonly correlationId: string;

  /** Causation id used to reconstruct execution order if needed. */
  readonly causationId?: string;

  /** Time when the command was created. */
  readonly timestamp: number;
}

export type CommandProps<T> = Omit<T, 'id' | 'metadata'> & Partial<CommandBase>;

/**
 * Base class for commands. A command is a state-changing intention dispatched
 * through the CQRS command bus to its handler.
 */
export class CommandBase {
  /** Command id, used for distributed tracing & idempotency. */
  readonly id: string;

  readonly metadata: CommandMetadata;

  constructor(props: CommandProps<unknown>) {
    if (Guard.isEmpty(props)) {
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
