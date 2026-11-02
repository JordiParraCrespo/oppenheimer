import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Pins one of the caller's tokens to a repository, over the narrowest. */
export class PinGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly githubRepoId: number;
  readonly tokenId: string;

  constructor(props: CommandProps<PinGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.githubRepoId = props.githubRepoId;
    this.tokenId = props.tokenId;
  }
}
