import { QueryBase } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

/**
 * Describes the credential the caller is using and what it can actually do.
 *
 * `grantedScopes` is what the credential carries; `effectiveScopes` is that
 * intersected with the owner's live roles — the honest answer, and what the MCP
 * server filters its tool list by.
 */
export class FindCurrentCredentialQuery extends QueryBase {
  readonly userId: string;
  readonly role?: string;
  readonly activeOrganizationId?: string | null;
  /** `null` for a browser session, which carries no scope restriction. */
  readonly grantedScopes: Scope[] | null;

  constructor(props: {
    userId: string;
    role?: string;
    activeOrganizationId?: string | null;
    grantedScopes: Scope[] | null;
  }) {
    super();
    this.userId = props.userId;
    this.role = props.role;
    this.activeOrganizationId = props.activeOrganizationId;
    this.grantedScopes = props.grantedScopes;
  }
}
