import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { SessionOrigin } from '../../domain/session-turn.policy';

export class CreateSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Whose session it is. A host is a person's, and so is the work put on it. */
  readonly userId: string;
  readonly input: CreateSessionDto;
  /** The caller's `Idempotency-Key` header, stored on the row so a retry returns this session. */
  readonly idempotencyKey: string | null;
  /**
   * Who asked for it: a person at the console, or an automation's run, which
   * dispatches this same command as the automation's owner. Required, so no
   * caller can forget it and mint a session the runs list cannot join back.
   */
  readonly origin: SessionOrigin;

  constructor(props: CommandProps<CreateSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
    this.origin = props.origin;
  }
}
