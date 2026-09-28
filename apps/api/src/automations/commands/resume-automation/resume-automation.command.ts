import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ResumeAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: CommandProps<ResumeAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
