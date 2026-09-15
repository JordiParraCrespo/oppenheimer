import type { PermissionGroup, Scope } from '@oppenheimer/shared';

/** Response shapes the CLI consumes. Mirrors the API's DTOs. */

export interface CurrentCredential {
  kind: 'session' | 'api-token' | 'oauth';
  userId: string;
  email: string;
  grantedScopes: Scope[] | null;
  effectiveScopes: Scope[];
  organizationIds: string[] | null;
  expiresAt: string | null;
}

export interface PermissionCatalog {
  groups: PermissionGroup[];
  grantable: Scope[];
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  organizationIds: string[] | null;
  ipAllowlist: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiToken extends ApiToken {
  /** Shown once, at creation. */
  token: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { action: string; subject: string }[];
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  role: string;
  user?: { email?: string; name?: string };
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
