import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RunAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;
  /** Set from a bot's Routines tab: the automation must be that bot's routine. */
  readonly botId?: string;
  /** The caller's `Idempotency-Key`: a retried Run now is the same run. */
  readonly idempotencyKey: string | null;

  constructor(props: CommandProps<RunAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
    this.botId = props.botId;
    this.idempotencyKey = props.idempotencyKey;
  }
}
