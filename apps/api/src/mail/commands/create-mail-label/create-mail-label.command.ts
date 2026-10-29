import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Creates a label in the caller's Gmail, shown in its label list. */
export class CreateMailLabelCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly name: string;

  constructor(props: CommandProps<CreateMailLabelCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.name = props.name;
  }
}
