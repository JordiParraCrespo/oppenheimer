import { QueryBase } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

/**
 * `grantedScopes` is what the credential carries; `effectiveScopes` is that
 * intersected with the owner's live roles.
 */
export class FindCurrentCredentialQuery extends QueryBase {
  readonly userId: string;
  readonly role?: string;
  readonly organizationId?: string | null;
  /** `null` for a browser session, which carries no scope restriction. */
  readonly grantedScopes: Scope[] | null;

  constructor(props: {
    userId: string;
    role?: string;
    organizationId?: string | null;
    grantedScopes: Scope[] | null;
  }) {
    super();
    this.userId = props.userId;
    this.role = props.role;
    this.organizationId = props.organizationId;
    this.grantedScopes = props.grantedScopes;
  }
}
