import type { IncomingHttpHeaders } from 'node:http';
import type { AddMemberDto, UpdateOrganizationDto } from '@oppenheimer/shared';
import type {
  FullOrganizationResponseDto,
  MemberResponseDto,
  OrganizationResponseDto,
} from '../dtos/organization.response.dto';

/** What a new organization is called and where it lives. */
export interface NewOrganization {
  name: string;
  slug: string;
  logo?: string;
}

/**
 * What the organization and membership use cases need from the identity
 * provider, which owns the `organization` and `member` tables and enforces its
 * own owner/admin/member rules. Every method takes the incoming request's
 * headers, because the provider decides what the caller may do from them.
 *
 * The members these return carry only what the provider's rows hold; the
 * account behind each one is read from the users table (`MemberRepositoryPort`).
 */
export interface OrganizationAuthPort {
  create(headers: IncomingHttpHeaders, input: NewOrganization): Promise<OrganizationResponseDto>;
  update(
    headers: IncomingHttpHeaders,
    organizationId: string,
    data: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto>;
  delete(headers: IncomingHttpHeaders, organizationId: string): Promise<OrganizationResponseDto>;
  /** Select the session's organization; `null` when the provider cleared it. */
  setActive(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<OrganizationResponseDto | null>;
  /** The organizations the caller belongs to, in the provider's order. */
  list(headers: IncomingHttpHeaders): Promise<OrganizationResponseDto[]>;
  /** With its members, invitations and teams; `null` when there is none. */
  getFull(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<FullOrganizationResponseDto | null>;
  isSlugAvailable(headers: IncomingHttpHeaders, slug: string): Promise<boolean>;

  listMembers(headers: IncomingHttpHeaders, organizationId: string): Promise<MemberResponseDto[]>;
  addMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    input: AddMemberDto,
  ): Promise<MemberResponseDto>;
  removeMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberIdOrEmail: string,
  ): Promise<MemberResponseDto>;
  updateMemberRole(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberId: string,
    role: string,
  ): Promise<MemberResponseDto>;
  /** The caller's own membership, ended; the provider refuses the last owner. */
  leave(headers: IncomingHttpHeaders, organizationId: string): Promise<MemberResponseDto>;
}
