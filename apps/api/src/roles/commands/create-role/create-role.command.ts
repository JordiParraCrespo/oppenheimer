import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PermissionDefinition } from '@oppenheimer/shared';

export class CreateRoleCommand extends CommandBase {
  readonly name: string;
  readonly description?: string;
  readonly permissions: PermissionDefinition[];

  readonly actorId?: string;
  readonly actorRole?: string;
  readonly organizationId?: string | null;
  /**
   * Create a global role (no organization) on purpose. Without it, a missing
   * `organizationId` is refused rather than read as "global"; with it, the
   * actor must hold `manage all`. No route sets it: global roles are the
   * platform's, created by seeds and internal callers.
   */
  readonly global?: boolean;

  constructor(props: CommandProps<CreateRoleCommand>) {
    super(props);
    this.name = props.name;
    this.description = props.description;
    this.permissions = props.permissions;
    this.actorId = props.actorId;
    this.actorRole = props.actorRole;
    this.organizationId = props.organizationId;
    this.global = props.global;
  }
}
