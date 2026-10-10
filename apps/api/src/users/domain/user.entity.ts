import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import { isAccessAllowed } from '../../auth/domain/account-access.policy';
import { UserDeactivatedDomainEvent } from './events/user-deactivated.domain-event';
import { UserDeletedDomainEvent } from './events/user-deleted.domain-event';
import { Email } from './value-objects/email.value-object';
import { Username } from './value-objects/username.value-object';

export interface UserProps {
  email: Email;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  username: Username | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  /**
   * The admin plugin's ban, read-only here: Better Auth writes it, and the
   * aggregate carries it only so the access rule can be asked of it.
   */
  banned: boolean;
  banExpires: Date | null;
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
  username?: string | null;
  avatarUrl?: string | null;
  role?: Role;
  isActive?: boolean;
}

/**
 * The profile fields the application owns on the Better Auth `user` record.
 * Identity, password and OAuth links remain owned by Better Auth.
 */
export class UserEntity extends AggregateRoot<UserProps> {
  protected _id!: string;

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

  get username(): string | null {
    return this.props.username?.value ?? null;
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

  get banned(): boolean {
    return this.props.banned;
  }

  get banExpires(): Date | null {
    return this.props.banExpires;
  }

  /** Whether the account may authenticate right now (see `isAccessAllowed`). */
  mayAct(now: Date): boolean {
    return isAccessAllowed(this.props, now);
  }

  updateProfile(props: UpdateUserProps): void {
    if (props.firstName !== undefined) this.props.firstName = props.firstName;
    if (props.lastName !== undefined) this.props.lastName = props.lastName;
    if (props.phone !== undefined) this.props.phone = props.phone;
    if (props.jobTitle !== undefined) this.props.jobTitle = props.jobTitle;
    if (props.username !== undefined) {
      this.props.username = props.username === null ? null : Username.from(props.username);
    }
    if (props.avatarUrl !== undefined) this.props.avatarUrl = props.avatarUrl;
    if (props.role !== undefined) this.props.role = props.role;
    if (props.isActive !== undefined) {
      if (props.isActive === false && this.props.isActive) {
        this.addEvent(
          new UserDeactivatedDomainEvent({
            aggregateId: this.id,
            reason: 'Account deactivated; its sessions and delegated sessions are revoked',
          }),
        );
      }
      this.props.isActive = props.isActive;
    }
    this.setUpdatedAt(new Date());
    this.validate();
  }

  rename(fullName: string): void {
    const [first, ...rest] = fullName.split(' ');
    this.props.firstName = first ?? '';
    this.props.lastName = rest.join(' ');
  }

  delete(): void {
    this.addEvent(
      new UserDeletedDomainEvent({
        aggregateId: this.id,
        email: this.props.email.value,
        reason: 'User account was deleted; downstream cleanup (sessions, files, analytics) is owed',
      }),
    );
  }

  /** Clear the optional contact fields in one step. */
  clearContactDetails(): void {
    this.props.phone = null;
    this.props.jobTitle = null;
    this.setUpdatedAt(new Date());
    this.validate();
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
