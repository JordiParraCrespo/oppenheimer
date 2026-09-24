import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';

/** Who a grant is addressed to. */
export type AccessGrantPrincipalType = 'user' | 'team' | 'role';

export interface AccessGrantProps {
  organizationId: string;
  principalType: AccessGrantPrincipalType;
  principalId: string;
  /** A registry subject, e.g. `Project`. */
  resourceType: string;
  /** `null` means every resource of that type within the organization. */
  resourceId: string | null;
  grantedBy: string;
  expiresAt: Date | null;
}

export interface IssueAccessGrantProps {
  organizationId: string;
  principalType: AccessGrantPrincipalType;
  principalId: string;
  resourceType: string;
  resourceId?: string | null;
  grantedBy: string;
  expiresAt?: Date | null;
}

/**
 * An explicit grant of access to rows a caller would not otherwise reach.
 *
 * The aggregate knows what a grant *is*; it does not decide who may create one
 * — that containment check needs the granter's own scope and lives in the
 * command handler.
 */
export class AccessGrantEntity extends AggregateRoot<AccessGrantProps> {
  static create(create: CreateEntityProps<AccessGrantProps>): AccessGrantEntity {
    return new AccessGrantEntity(create);
  }

  static issue(props: IssueAccessGrantProps): AccessGrantEntity {
    return new AccessGrantEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        principalType: props.principalType,
        principalId: props.principalId,
        resourceType: props.resourceType,
        resourceId: props.resourceId ?? null,
        grantedBy: props.grantedBy,
        expiresAt: props.expiresAt ?? null,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get principalType(): AccessGrantPrincipalType {
    return this.props.principalType;
  }

  get principalId(): string {
    return this.props.principalId;
  }

  get resourceType(): string {
    return this.props.resourceType;
  }

  get resourceId(): string | null {
    return this.props.resourceId;
  }

  get grantedBy(): string {
    return this.props.grantedBy;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  /** Whether this grant covers every row of its resource type. */
  isBlanket(): boolean {
    return this.props.resourceId === null;
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('An access grant must belong to an organization');
    }
    if (!this.props.principalId?.trim()) {
      throw new ArgumentNotProvidedException('An access grant must name a principal');
    }
    if (!this.props.resourceType?.trim()) {
      throw new ArgumentNotProvidedException('An access grant must name a resource type');
    }
  }
}
