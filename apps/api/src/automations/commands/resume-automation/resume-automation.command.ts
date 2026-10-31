import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class ResumeAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: CommandProps<ResumeAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
