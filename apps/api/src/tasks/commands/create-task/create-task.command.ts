import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateTaskDto } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class CreateTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  /** The caller's `Idempotency-Key`, so a retried create makes one row. */
  readonly idempotencyKey: string | null;
  readonly userId: string;
  readonly input: CreateTaskDto;

  constructor(props: CommandProps<CreateTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.idempotencyKey = props.idempotencyKey;
    this.userId = props.userId;
    this.input = props.input;
  }
}
