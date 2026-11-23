import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Forget a routine's webhook URL: posts to it are refused from now on. */
export class RevokeRoutineWebhookCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly routineId: string;

  constructor(props: CommandProps<RevokeRoutineWebhookCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.routineId = props.routineId;
  }
}
