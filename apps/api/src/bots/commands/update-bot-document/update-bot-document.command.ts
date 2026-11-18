import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateBotDocumentDto } from '@oppenheimer/shared';

export class UpdateBotDocumentCommand extends CommandBase {
  /** The caller, who is the new revision's author. */
  readonly scope: AccessScope;
  readonly botId: string;
  /** As the path spelled it; checked against the two names by the handler. */
  readonly name: string;
  readonly input: UpdateBotDocumentDto;

  constructor(props: CommandProps<UpdateBotDocumentCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.name = props.name;
    this.input = props.input;
  }
}
