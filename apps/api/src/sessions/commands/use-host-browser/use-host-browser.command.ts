import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { HostBrowserRequest } from '../../application/host-browser.port';

/** Do one action in a bot's browser on a host and wait for the page. */
export class UseHostBrowserCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly request: HostBrowserRequest;
  /** Names the action across retries of one approved call; absent, each dispatch is a new one. */
  readonly commandId?: string;

  constructor(props: CommandProps<UseHostBrowserCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.request = props.request;
    this.commandId = props.commandId;
  }
}
