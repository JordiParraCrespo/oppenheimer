import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class PauseAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: CommandProps<PauseAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
