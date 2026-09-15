import type { Role } from '@oppenheimer/shared';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: Role,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isAdmin(): boolean {
    return this.platformRoles.includes('admin');
  }

  get isSuperAdmin(): boolean {
    return this.platformRoles.includes('superadmin');
  }

  get canAccessControlPlane(): boolean {
    return this.isAdmin || this.isSuperAdmin;
  }

  private get platformRoles(): string[] {
    return this.role
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }
}
