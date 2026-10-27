import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class FollowUpCloudAgentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly agentId: string;
  readonly prompt: string;

  constructor(props: CommandProps<FollowUpCloudAgentCommand>) {
    super(props);
    this.scope = props.scope;
    this.agentId = props.agentId;
    this.prompt = props.prompt;
  }
}
