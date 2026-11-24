import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A new URL for a routine's webhook, replacing any it had; signed when asked. */
export class IssueRoutineWebhookCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly routineId: string;
  readonly signed: boolean;

  constructor(props: CommandProps<IssueRoutineWebhookCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.routineId = props.routineId;
    this.signed = props.signed;
  }
}
