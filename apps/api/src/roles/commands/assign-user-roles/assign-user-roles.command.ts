import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class AssignUserRolesCommand extends CommandBase {
  readonly userId: string;
  readonly roleIds: string[];
  readonly organizationId?: string | null;

  readonly actorId?: string;
  readonly actorRole?: string;

  constructor(props: CommandProps<AssignUserRolesCommand>) {
    super(props);
    this.userId = props.userId;
    this.roleIds = props.roleIds;
    this.organizationId = props.organizationId;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
  }
}
