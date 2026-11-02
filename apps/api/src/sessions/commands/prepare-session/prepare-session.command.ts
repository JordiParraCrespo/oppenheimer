import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PrepareSessionInput } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class PrepareSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: PrepareSessionInput;

  constructor(props: CommandProps<PrepareSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
