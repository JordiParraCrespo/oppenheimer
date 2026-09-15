import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteRoleCommand extends CommandBase {
  readonly roleId: string;
  readonly activeOrganizationId?: string | null;

  readonly actorId?: string;
  readonly actorRole?: string;

  constructor(props: CommandProps<DeleteRoleCommand>) {
    super(props);
    this.roleId = props.roleId;
    this.activeOrganizationId = props.activeOrganizationId;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
  }
}
