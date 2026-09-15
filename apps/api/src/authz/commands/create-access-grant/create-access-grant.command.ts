import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessGrantPrincipalType } from '../../domain/access-grant.entity';

export class CreateAccessGrantCommand extends CommandBase {
  /** The granter's own reach — what the new grant may not exceed. */
  readonly scope: AccessScope;
  readonly principalType: AccessGrantPrincipalType;
  readonly principalId: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly expiresAt?: string | null;

  constructor(props: CommandProps<CreateAccessGrantCommand>) {
    super(props);
    this.scope = props.scope;
    this.principalType = props.principalType;
    this.principalId = props.principalId;
    this.resourceType = props.resourceType;
    this.resourceId = props.resourceId;
    this.expiresAt = props.expiresAt;
  }
}
