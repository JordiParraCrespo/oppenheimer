import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class AppendCloudTranscriptCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Claude Code's cloud session id, as the console names it (`session_…`). */
  readonly cloudSessionId: string;
  readonly from: number;
  readonly lines: readonly string[];

  constructor(props: CommandProps<AppendCloudTranscriptCommand>) {
    super(props);
    this.scope = props.scope;
    this.cloudSessionId = props.cloudSessionId;
    this.from = props.from;
    this.lines = props.lines;
  }
}
