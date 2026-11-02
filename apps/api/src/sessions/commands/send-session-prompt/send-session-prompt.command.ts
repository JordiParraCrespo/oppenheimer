import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionPromptSender } from '../../domain/session-prompt.policy';

export class SendSessionPromptCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** The words, already held to the prompt's bound by the caller. */
  readonly text: string;
  readonly sender: SessionPromptSender;

  constructor(props: CommandProps<SendSessionPromptCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.text = props.text;
    this.sender = props.sender;
  }
}
