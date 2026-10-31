import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AddCheckoutDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class AddCheckoutCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly input: AddCheckoutDto;

  constructor(props: CommandProps<AddCheckoutCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.input = props.input;
  }
}
