import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionFileHint } from '@oppenheimer/shared/protocol';

export class PasteSessionImageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly window: number;
  readonly data: Buffer;
  /** What the browser said the file is, label and name. Read only to pick a text type. */
  readonly hint: SessionFileHint;

  constructor(props: CommandProps<PasteSessionImageCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.window = props.window;
    this.data = props.data;
    this.hint = props.hint;
  }
}
