import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateAutomationSettingsDto } from '@oppenheimer/shared';

export class UpdateAutomationSettingsCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: UpdateAutomationSettingsDto;

  constructor(props: CommandProps<UpdateAutomationSettingsCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
