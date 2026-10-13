import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { StartTaskSessionDto } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class StartTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly userId: string;
  readonly taskId: string;
  readonly input: StartTaskSessionDto;
  /** The caller's `Idempotency-Key`, so a retry returns the session already started. */
  readonly idempotencyKey: string | null;

  constructor(props: CommandProps<StartTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.userId = props.userId;
    this.taskId = props.taskId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
  }
}
