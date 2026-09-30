/**
 * An invitation to join an organization: Better Auth's `invitation` row. A
 * read model — Better Auth issues, answers and writes it, so there is no
 * aggregate behind it.
 *
 * `status` is Better Auth's vocabulary (`pending`, `accepted`, `rejected`,
 * `canceled`); an answered invitation is kept, not deleted.
 */
export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  /** The organization role it grants (`owner`, `admin`, `member`). */
  role: string | null;
  status: string;
  teamId: string | null;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationCaller {
  id: string;
  email: string;
}
