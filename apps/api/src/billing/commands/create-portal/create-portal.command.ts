import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CreatePortalCommand extends CommandBase {
  readonly userId: string;
  readonly returnUrl?: string;

  constructor(props: CommandProps<CreatePortalCommand>) {
    super(props);
    this.userId = props.userId;
    this.returnUrl = props.returnUrl;
  }
}
