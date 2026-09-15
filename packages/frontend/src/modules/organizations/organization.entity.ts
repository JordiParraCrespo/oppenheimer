/** An organization as the UI needs it. */
export class OrganizationEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    /** Square mark shown in the sidebar and on exported reports. */
    public readonly logo: string | null,
    public readonly createdAt: Date,
  ) {}
}

export class OrganizationMemberEntity {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly organizationRole: string,
    public readonly joinedAt: Date,
    public readonly name: string,
    public readonly email: string,
    public readonly image: string | null,
    public readonly isActive: boolean,
    public readonly emailVerified: boolean,
  ) {}
}

export class OrganizationInvitationEntity {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly organizationRole: string,
    public readonly status: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}
}
