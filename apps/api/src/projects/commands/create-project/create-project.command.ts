import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateProjectDto } from '@oppenheimer/shared';

export class CreateProjectCommand extends CommandBase {
  /** The workspace the project is created in, and who creates it. */
  readonly scope: AccessScope;
  readonly input: CreateProjectDto;

  constructor(props: CommandProps<CreateProjectCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}
