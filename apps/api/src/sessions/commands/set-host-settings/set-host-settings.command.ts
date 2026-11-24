import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { HostSettingsChange } from '../../application/host-settings.port';

/** Change what a host lets bots do, for a bot the person asked, and wait for the result. */
export class SetHostSettingsCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly change: HostSettingsChange;

  constructor(props: CommandProps<SetHostSettingsCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.change = props.change;
  }
}
