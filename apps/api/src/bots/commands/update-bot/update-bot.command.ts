import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateBotDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UpdateBotCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly input: UpdateBotDto;

  constructor(props: CommandProps<UpdateBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.input = props.input;
  }
}
