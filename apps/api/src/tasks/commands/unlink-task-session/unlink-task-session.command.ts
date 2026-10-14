import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PlanActor } from '../../domain/plan-change.types';

export class UnlinkTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly taskId: string;
  readonly sessionId: string;

  constructor(props: CommandProps<UnlinkTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.taskId = props.taskId;
    this.sessionId = props.sessionId;
  }
}
