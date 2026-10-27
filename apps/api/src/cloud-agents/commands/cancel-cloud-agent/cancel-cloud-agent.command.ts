import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CancelCloudAgentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly agentId: string;

  constructor(props: CommandProps<CancelCloudAgentCommand>) {
    super(props);
    this.scope = props.scope;
    this.agentId = props.agentId;
  }
}
