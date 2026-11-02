import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InstallationAddress } from '../../application/pull-request-access.port';

/**
 * No controller: a bot's `comment_on_issue` and `comment_on_pull_request`
 * tools dispatch it (`25-bots.md` §4.4). GitHub numbers issues and pull
 * requests alike, so the address is either's.
 */
export class AddIssueCommentCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Written in the caller's name, so only where the App reaches. */
  readonly address: InstallationAddress & { number: number };
  readonly body: string;

  constructor(props: CommandProps<AddIssueCommentCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.body = props.body;
  }
}
