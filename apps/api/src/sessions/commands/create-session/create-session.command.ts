import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateSessionDto } from '@oppenheimer/shared';

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

  constructor(props: CommandProps<CreateSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
  }
}
