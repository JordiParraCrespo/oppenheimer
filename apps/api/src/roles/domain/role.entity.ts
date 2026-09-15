import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { RoleDeletedDomainEvent } from './events/role-deleted.domain-event';
import { Permission } from './value-objects/permission.value-object';

export interface RoleProps {
  /** Unique, immutable, machine-readable name (e.g. `editor`, `support`). */
  name: string;
  description: string | null;
  /** System roles (`admin`, `user`) are seeded and cannot be deleted/renamed. */
  isSystem: boolean;
  /** Owning organization, or `null` for a global/system role template. */
  organizationId: string | null;
  permissions: Permission[];
}

export interface CreateRoleProps {
  name: string;
  description?: string | null;
  organizationId?: string | null;
  permissions?: Permission[];
}

/**
 * Role aggregate root. Owns its set of {@link Permission} value objects and the
 * invariants protecting the platform's built-in roles. The union of every role
 * assigned to a user determines that user's effective CASL ability.
 */
export class RoleEntity extends AggregateRoot<RoleProps> {
  /** Rehydrate an existing role (used by the mapper). */
  static create(create: CreateEntityProps<RoleProps>): RoleEntity {
    return new RoleEntity(create);
  }

  /** Create a brand-new, non-system role with a generated id. */
  static createNew(props: CreateRoleProps): RoleEntity {
    return new RoleEntity({
      id: randomUUID(),
      props: {
        name: props.name,
        description: props.description ?? null,
        isSystem: false,
        organizationId: props.organizationId ?? null,
        permissions: props.permissions ?? [],
      },
    });
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get isSystem(): boolean {
    return this.props.isSystem;
  }

  /** `null` for a global role; otherwise the tenant that owns it. */
  get organizationId(): string | null {
    return this.props.organizationId;
  }

  /**
   * Whether this role is global rather than owned by a tenant. Global roles
   * are editable only by the platform tier — an organization admin editing one
   * would be changing every other tenant's authorization.
   */
  isGlobal(): boolean {
    return this.props.organizationId === null;
  }

  get permissions(): Permission[] {
    return this.props.permissions;
  }

  /**
   * Whether a permission set grants CASL's wildcard `manage all` (full access).
   * Used to protect system roles from being stripped of their break-glass
   * access, which would otherwise lock every admin out of the management API.
   */
  static grantsFullAccess(permissions: Permission[]): boolean {
    return permissions.some(
      (permission) =>
        permission.action === 'manage' &&
        permission.subject === 'all' &&
        permission.toDefinition().inverted !== true,
    );
  }

  /** Whether this role currently grants full access (`manage all`). */
  hasFullAccess(): boolean {
    return RoleEntity.grantsFullAccess(this.props.permissions);
  }

  updateDescription(description: string | null): void {
    this.props.description = description ?? null;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** Replace the role's full permission set (granular permission editing). */
  replacePermissions(permissions: Permission[]): void {
    this.props.permissions = permissions;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Mark the role for deletion. The system-role guard lives in the application
   * handler (the domain stays free of the `AppError` catalog).
   */
  delete(): void {
    this.addEvent(
      new RoleDeletedDomainEvent({
        aggregateId: this.id,
        name: this.props.name,
        reason: 'Role was deleted; listeners react to it disappearing from every holder',
      }),
    );
  }

  public validate(): void {
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('Role name cannot be empty');
    }
  }
}
