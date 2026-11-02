import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class IssueSessionPreviewCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly userId: string;
  /** The session's port to open: one its own processes listen on. */
  readonly port: number;
  /** The path in the app to land on. */
  readonly path?: string;
  /** Framed by the console's Browser tab, rather than a tab of its own. */
  readonly embed: boolean;

  constructor(props: CommandProps<IssueSessionPreviewCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.port = props.port;
    this.path = props.path;
    this.embed = props.embed;
  }
}
