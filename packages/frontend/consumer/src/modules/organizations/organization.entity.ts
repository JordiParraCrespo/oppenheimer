/**
 * The caller's personal workspace as the UI needs it. The Better Auth
 * `organization` row is that workspace, created at sign-up with the account as
 * its single owner (`product/versions/mvp/08-auth.md`); the console renames it
 * and shows its mark, nothing more. Teams come later on the same table.
 */
export class OrganizationEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    /** Square mark shown in the sidebar. */
    public readonly logo: string | null,
    public readonly createdAt: Date,
  ) {}
}
