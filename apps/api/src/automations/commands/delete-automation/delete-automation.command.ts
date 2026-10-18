import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;
  /** Set from a bot's Routines tab: the automation must be that bot's routine. */
  readonly botId?: string;

  constructor(props: CommandProps<DeleteAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
    this.botId = props.botId;
  }
}
