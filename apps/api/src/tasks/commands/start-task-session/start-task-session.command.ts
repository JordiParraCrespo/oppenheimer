import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { StartTaskSessionDto } from '@oppenheimer/shared';

export class StartTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly taskId: string;
  readonly input: StartTaskSessionDto;
  /** The caller's `Idempotency-Key`, so a retry returns the session already started. */
  readonly idempotencyKey: string | null;

  constructor(props: CommandProps<StartTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.taskId = props.taskId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
  }
}
