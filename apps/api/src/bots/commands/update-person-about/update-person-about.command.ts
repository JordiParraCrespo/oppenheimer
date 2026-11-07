import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdatePersonAboutCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly about: string;

  constructor(props: CommandProps<UpdatePersonAboutCommand>) {
    super(props);
    this.scope = props.scope;
    this.about = props.about;
  }
}
