import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Deletes one of the caller's tokens and its pins. */
export class RemoveGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly tokenId: string;

  constructor(props: CommandProps<RemoveGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.tokenId = props.tokenId;
  }
}
