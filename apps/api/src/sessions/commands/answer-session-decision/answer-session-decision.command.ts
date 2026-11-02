import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AnswerSessionDecisionDto } from '@oppenheimer/shared';

export class AnswerSessionDecisionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly answer: AnswerSessionDecisionDto;

  constructor(props: CommandProps<AnswerSessionDecisionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.answer = props.answer;
  }
}
