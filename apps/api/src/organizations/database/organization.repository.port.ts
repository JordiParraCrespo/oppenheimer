import type { Option } from 'oxide.ts';
import type { Organization, Workspace, WorkspaceMember } from '../domain/organization.types';

/**
 * Reads Better Auth's `organization`, `team` and `teamMember` tables, so a use
 * case can answer with what it just wrote. Read-only: those rows are written
 * through Better Auth's API, which owns them.
 */
export interface OrganizationRepositoryPort {
  findOrganization(organizationId: string): Promise<Option<Organization>>;
  findWorkspace(workspaceId: string): Promise<Option<Workspace>>;
  findWorkspaceMember(workspaceId: string, userId: string): Promise<Option<WorkspaceMember>>;
}
