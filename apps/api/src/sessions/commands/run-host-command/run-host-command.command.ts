import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { HostExecRequest } from '../../application/host-exec.port';

/** Run one program on a host, for a bot, and wait for how it ended. */
export class RunHostCommandCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly request: HostExecRequest;
  /** Names the run across retries of one approved call; absent, each dispatch is a new run. */
  readonly commandId?: string;

  constructor(props: CommandProps<RunHostCommandCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.request = props.request;
    this.commandId = props.commandId;
  }
}
