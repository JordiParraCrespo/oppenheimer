import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { InstallationAddress } from '../../application/pull-request-access.port';
import type { GithubIssueInput } from '../../infrastructure/github-issues.port';

/** The new issue's number and link: GitHub's id for it, and where to read it. */
export interface CreatedIssue {
  number: number;
  htmlUrl: string;
}

/** No controller: a bot's `create_issue` tool dispatches it (`25-bots.md` §4.4). */
export class CreateIssueCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Opened in the caller's name, so only where the App reaches. */
  readonly repository: InstallationAddress;
  readonly issue: GithubIssueInput;

  constructor(props: CommandProps<CreateIssueCommand>) {
    super(props);
    this.scope = props.scope;
    this.repository = props.repository;
    this.issue = props.issue;
  }
}
