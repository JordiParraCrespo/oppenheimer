import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { MailLabelChange } from '../../domain/mail-organize.policy';

/**
 * Adds and takes off labels on threads and messages of the caller's Gmail:
 * marking, labelling and archiving are all this (`mail.md` §3.5).
 */
export class OrganizeMailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly threadIds: readonly string[];
  readonly messageIds: readonly string[];
  readonly change: MailLabelChange;

  constructor(props: CommandProps<OrganizeMailCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.threadIds = props.threadIds;
    this.messageIds = props.messageIds;
    this.change = props.change;
  }
}
