import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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
