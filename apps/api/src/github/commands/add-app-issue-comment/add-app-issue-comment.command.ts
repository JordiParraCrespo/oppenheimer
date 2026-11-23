import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InstallationAddress } from '../../application/pull-request-access.port';

/**
 * No controller: a bot's answer to an ask on GitHub (a mention, a `bot:`
 * label) is posted with it once the turn ends. Posted as the App, in the
 * scope of the bot's owner, who asked.
 */
export class AddAppIssueCommentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: InstallationAddress & { number: number };
  readonly body: string;

  constructor(props: CommandProps<AddAppIssueCommentCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.body = props.body;
  }
}
