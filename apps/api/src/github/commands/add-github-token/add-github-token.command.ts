import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Adds a token of the caller's own, once GitHub says whose it is and what it opens. */
export class AddGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly label: string;
  readonly token: string;

  constructor(props: CommandProps<AddGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.label = props.label;
    this.token = props.token;
  }
}
