import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MoveTaskDto } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class MoveTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly taskId: string;
  readonly move: MoveTaskDto;

  constructor(props: CommandProps<MoveTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.taskId = props.taskId;
    this.move = props.move;
  }
}
