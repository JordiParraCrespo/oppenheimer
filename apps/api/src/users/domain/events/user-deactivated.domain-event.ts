import { DomainEvent } from '@oppenheimer/backend-ddd';

/**
 * Raised when an active account is deactivated. The access rule already
 * refuses the account on its next request; the handler owes the revocation of
 * what it left behind — its sessions and cached delegated sessions — so a
 * later reactivation does not bring them back.
 */
export class UserDeactivatedDomainEvent extends DomainEvent {}
