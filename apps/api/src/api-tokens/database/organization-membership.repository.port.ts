/**
 * Read-only view of organization membership, used when minting a token to
 * verify the creator actually belongs to every organization they want to
 * restrict it to. Kept as a port so the command handler never reaches into the
 * organizations module's persistence model.
 */
export interface OrganizationMembershipReaderPort {
  /** Ids of the organizations this user is a member of. */
  findOrganizationIdsForUser(userId: string): Promise<string[]>;
}
