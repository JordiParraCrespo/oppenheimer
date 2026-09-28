/**
 * What an account owes when it may no longer act: every way it is signed in
 * right now, revoked. Its browser sessions live with the identity provider and
 * its scoped credentials hold cached delegated sessions; both go.
 *
 * The access rule already refuses the account on its next request, so this is
 * about not leaving live rows behind for a later reactivation to resurrect, and
 * about the "Active sessions" list telling the truth.
 */
export interface AccountSessionsPort {
  revokeAll(userId: string): Promise<void>;
}
