import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Asks GitHub again what one of the caller's tokens opens and when it expires. */
export class CheckGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly tokenId: string;

  constructor(props: CommandProps<CheckGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.tokenId = props.tokenId;
  }
}
