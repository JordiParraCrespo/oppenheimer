import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DuplicateAutomationCommand extends CommandBase {
  /** The caller, who owns the copy. */
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: CommandProps<DuplicateAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
