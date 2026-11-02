import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateAutomationDto } from '@oppenheimer/shared';

export class UpdateAutomationCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly automationId: string;
  readonly input: UpdateAutomationDto;

  constructor(props: CommandProps<UpdateAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.automationId = props.automationId;
    this.input = props.input;
  }
}
