import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { LaunchCloudAgentDto } from '@oppenheimer/shared';

export class LaunchCloudAgentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: LaunchCloudAgentDto;

  constructor(props: CommandProps<LaunchCloudAgentCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
