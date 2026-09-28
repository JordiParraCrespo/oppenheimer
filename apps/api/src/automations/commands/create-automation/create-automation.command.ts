import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateAutomationDto } from '@oppenheimer/shared';

export class CreateAutomationCommand extends CommandBase {
  /** The caller, who becomes the owner every run acts as. */
  readonly scope: AccessScope;
  readonly input: CreateAutomationDto;

  constructor(props: CommandProps<CreateAutomationCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
