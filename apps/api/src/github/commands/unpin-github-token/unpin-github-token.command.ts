import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Lets the narrowest of the caller's tokens read a repository again. */
export class UnpinGithubTokenCommand extends CommandBase {
  readonly userId: string;
  readonly githubRepoId: number;

  constructor(props: CommandProps<UnpinGithubTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.githubRepoId = props.githubRepoId;
  }
}
