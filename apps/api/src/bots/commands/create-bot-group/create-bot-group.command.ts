import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateBotGroupDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class CreateBotGroupCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: CreateBotGroupDto;

  constructor(props: CommandProps<CreateBotGroupCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
