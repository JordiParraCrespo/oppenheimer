import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class PasteSessionImageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly window: number;
  readonly data: Buffer;

  constructor(props: CommandProps<PasteSessionImageCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.window = props.window;
    this.data = props.data;
  }
}
