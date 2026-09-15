export class AdminUserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly platformRole: string | null,
    public readonly emailVerified: boolean,
    public readonly banned: boolean,
    public readonly banReason: string | null,
    public readonly banExpires: Date | null,
    public readonly createdAt: Date,
  ) {}

  get platformRoles(): string[] {
    return (this.platformRole ?? '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }

  get isSuperAdmin(): boolean {
    return this.platformRoles.includes('superadmin');
  }
}
export class AdminSessionEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly expiresAt: Date,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly createdAt: Date,
  ) {}
}
