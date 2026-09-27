import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { SessionOrigin } from '../../domain/session-turn.policy';

export class CreateSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Whose session it is. A host is a person's, and so is the work put on it. */
  readonly userId: string;
  readonly input: CreateSessionDto;
  /**
   * The caller's `Idempotency-Key` header, stored on the row so a retry after a lost
   * response returns the session already created rather than minting a second
   * directory and a second branch. Absent header, absent protection.
   */
  readonly idempotencyKey: string | null;
  /**
   * Who asked for it. Absent is a person at the console; an automation's run
   * dispatches this same command as the automation's owner and says so here.
   */
  readonly origin: SessionOrigin;

  constructor(
    props: Omit<CommandProps<CreateSessionCommand>, 'origin'> & { origin?: SessionOrigin },
  ) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
    this.origin = props.origin ?? 'person';
  }
}
