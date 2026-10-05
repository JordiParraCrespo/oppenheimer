import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteRoleCommand extends CommandBase {
  readonly roleId: string;
  readonly organizationId?: string | null;

  readonly actorId?: string;
  readonly actorRole?: string;

  constructor(props: CommandProps<DeleteRoleCommand>) {
    super(props);
    this.roleId = props.roleId;
    this.organizationId = props.organizationId;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
  }
}
