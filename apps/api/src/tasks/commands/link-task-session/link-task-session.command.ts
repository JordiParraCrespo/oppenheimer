import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TaskStatus } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class LinkTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly userId: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly seenStatus: TaskStatus;

  constructor(props: CommandProps<LinkTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.userId = props.userId;
    this.taskId = props.taskId;
    this.sessionId = props.sessionId;
    this.seenStatus = props.seenStatus;
  }
}
