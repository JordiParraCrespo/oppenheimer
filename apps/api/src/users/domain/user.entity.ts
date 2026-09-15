import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import { UserDeletedDomainEvent } from './events/user-deleted.domain-event';
import { Email } from './value-objects/email.value-object';

export interface UserProps {
  email: Email;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
}

/**
 * A partial profile update. `undefined` leaves a field untouched; an explicit
 * `null` clears one — that distinction is what lets a client empty their phone
 * number without having to send every other field along with it.
 */
export interface UpdateUserProps {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  role?: Role;
  isActive?: boolean;
}

/**
 * User aggregate root. Holds the profile fields the application owns on the
 * Better Auth `user` record and protects their invariants. Identity, password
 * and OAuth links remain owned by Better Auth.
 */
export class UserEntity extends AggregateRoot<UserProps> {
  static create(create: CreateEntityProps<UserProps>): UserEntity {
    return new UserEntity(create);
  }

  get email(): string {
    return this.props.email.value;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get jobTitle(): string | null {
    return this.props.jobTitle;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get role(): Role {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get emailVerified(): boolean {
    return this.props.emailVerified;
  }

  /** Apply a partial profile update, ignoring fields left undefined. */
  updateProfile(props: UpdateUserProps): void {
    if (props.firstName !== undefined) this.props.firstName = props.firstName;
    if (props.lastName !== undefined) this.props.lastName = props.lastName;
    if (props.phone !== undefined) this.props.phone = props.phone;
    if (props.jobTitle !== undefined) this.props.jobTitle = props.jobTitle;
    if (props.avatarUrl !== undefined) this.props.avatarUrl = props.avatarUrl;
    if (props.role !== undefined) this.props.role = props.role;
    if (props.isActive !== undefined) this.props.isActive = props.isActive;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** Mark the user for deletion and raise the corresponding domain event. */
  delete(): void {
    this.addEvent(
      new UserDeletedDomainEvent({
        aggregateId: this.id,
        email: this.props.email.value,
        reason: 'User account was deleted; downstream cleanup (sessions, files, analytics) is owed',
      }),
    );
  }

  public validate(): void {
    if (!this.props.firstName) {
      throw new ArgumentNotProvidedException('User firstName cannot be empty');
    }
    if (!this.props.lastName) {
      throw new ArgumentNotProvidedException('User lastName cannot be empty');
    }
  }
}
