import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetSessionSharePeopleCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly people: string[];

  constructor(props: CommandProps<SetSessionSharePeopleCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.people = props.people;
  }
}
