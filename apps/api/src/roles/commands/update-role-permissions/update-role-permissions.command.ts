import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PermissionDefinition } from '@oppenheimer/shared';

export class UpdateRolePermissionsCommand extends CommandBase {
  readonly roleId: string;
  readonly permissions: PermissionDefinition[];

  readonly actorId?: string;
  readonly actorRole?: string;
  readonly organizationId?: string | null;

  constructor(props: CommandProps<UpdateRolePermissionsCommand>) {
    super(props);
    this.roleId = props.roleId;
    this.permissions = props.permissions;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
    this.organizationId = props.organizationId;
  }
}
