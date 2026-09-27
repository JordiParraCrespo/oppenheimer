import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PermissionDefinition } from '@oppenheimer/shared';

export class UpdateRoleCommand extends CommandBase {
  readonly roleId: string;
  readonly description?: string;
  readonly permissions?: PermissionDefinition[];

  readonly actorId?: string;
  readonly actorRole?: string;
  readonly organizationId?: string | null;

  constructor(props: CommandProps<UpdateRoleCommand>) {
    super(props);
    this.roleId = props.roleId;
    this.description = props.description;
    this.permissions = props.permissions;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
    this.organizationId = props.organizationId;
  }
}
