import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ConnectGmailDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class ConnectGmailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: ConnectGmailDto;

  constructor(props: CommandProps<ConnectGmailCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
