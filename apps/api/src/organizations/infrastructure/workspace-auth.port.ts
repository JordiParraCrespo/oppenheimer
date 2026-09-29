import type { IncomingHttpHeaders } from 'node:http';
import type {
  WorkspaceMemberResponseDto,
  WorkspaceResponseDto,
} from '../dtos/workspace.response.dto';

/**
 * What the workspace use cases need from the identity provider. A workspace is
 * a Better Auth team inside an organization; the provider owns the `team` and
 * `teamMember` tables and checks, from the request's headers, that the caller
 * may manage them.
 */
export interface WorkspaceAuthPort {
  create(
    headers: IncomingHttpHeaders,
    input: { name: string; organizationId?: string },
  ): Promise<WorkspaceResponseDto>;
  rename(headers: IncomingHttpHeaders, teamId: string, name: string): Promise<WorkspaceResponseDto>;
  remove(headers: IncomingHttpHeaders, teamId: string): Promise<void>;
  /** Select the session's workspace; `null` when the provider cleared it. */
  setActive(headers: IncomingHttpHeaders, teamId: string): Promise<WorkspaceResponseDto | null>;
  /** An organization's workspaces; the session's organization when none is named. */
  listForOrganization(
    headers: IncomingHttpHeaders,
    organizationId?: string,
  ): Promise<WorkspaceResponseDto[]>;
  listForCaller(headers: IncomingHttpHeaders): Promise<WorkspaceResponseDto[]>;
  listMembers(headers: IncomingHttpHeaders, teamId: string): Promise<WorkspaceMemberResponseDto[]>;
  addMember(
    headers: IncomingHttpHeaders,
    teamId: string,
    userId: string,
  ): Promise<WorkspaceMemberResponseDto>;
  removeMember(headers: IncomingHttpHeaders, teamId: string, userId: string): Promise<void>;
}
