import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

/**
 * No controller: a bot's `comment_on_pull_request` tool dispatches it
 * (`25-bots.md` §4.4). A comment on the conversation, not on a line: the
 * console posts line comments only.
 */
export class AddPullRequestConversationCommentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly body: string;

  constructor(props: CommandProps<AddPullRequestConversationCommentCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.body = props.body;
  }
}
