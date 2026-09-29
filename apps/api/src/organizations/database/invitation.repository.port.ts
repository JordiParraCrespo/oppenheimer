import type { Option } from 'oxide.ts';
import type { Invitation } from '../domain/invitation.types';

/**
 * Reads Better Auth's `invitation` table. Read-only: invitations are issued and
 * answered through Better Auth's API, which owns the table.
 */
export interface InvitationRepositoryPort {
  findOneById(invitationId: string): Promise<Option<Invitation>>;
}
