import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { HostComputerRequest } from '../../application/host-computer.port';

/** Do one action on a host's screen, for a bot, and wait for what it shows. */
export class UseHostComputerCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly request: HostComputerRequest;
  /** Names the action across retries of one approved call; absent, each dispatch is a new one. */
  readonly commandId?: string;

  constructor(props: CommandProps<UseHostComputerCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.request = props.request;
    this.commandId = props.commandId;
  }
}
