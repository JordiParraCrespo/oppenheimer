import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CloudChatEvent } from '../../database/session-cloud-chat.repository.port';

export class RecordCloudEventsCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who the browser extension reads claude.ai for: an adopted session is theirs. */
  readonly userId: string;
  /** Claude Code's cloud session id, as the console names it (`session_…`). */
  readonly cloudSessionId: string;
  readonly title: string | undefined;
  readonly events: readonly CloudChatEvent[];

  constructor(props: CommandProps<RecordCloudEventsCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.cloudSessionId = props.cloudSessionId;
    this.title = props.title;
    this.events = props.events;
  }
}
