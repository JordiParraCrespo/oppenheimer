import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Gives one of the caller's tokens another label. */
export class RenameGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly tokenId: string;
  readonly label: string;

  constructor(props: CommandProps<RenameGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.tokenId = props.tokenId;
    this.label = props.label;
  }
}
