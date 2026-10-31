import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class DisconnectInstallationCommand extends CommandBase {
  /** The caller's resolved scope, so the write reads the row the same way a
   *  list would — an installation it cannot see cannot be disconnected. */
  readonly scope: AccessScope;
  readonly installationId: string;

  constructor(props: CommandProps<DisconnectInstallationCommand>) {
    super(props);
    this.scope = props.scope;
    this.installationId = props.installationId;
  }
}
