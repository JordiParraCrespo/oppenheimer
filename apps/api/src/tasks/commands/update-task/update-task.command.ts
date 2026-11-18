import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TaskOrigin, UpdateTaskDto } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class UpdateTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  /** Whether the person made the request or an agent did: only the person's takes up an agent's task. */
  readonly origin: TaskOrigin;
  readonly taskId: string;
  readonly changes: UpdateTaskDto;

  constructor(props: CommandProps<UpdateTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.origin = props.origin;
    this.taskId = props.taskId;
    this.changes = props.changes;
  }
}
