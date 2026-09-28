import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import type { AddMemberDto, UpdateOrganizationDto } from '@oppenheimer/shared';
import { APIError } from 'better-auth/api';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { betterAuthHeaders, unwrap, unwrapArray } from '../../auth/infrastructure/better-auth.util';
import type {
  FullOrganizationResponseDto,
  MemberResponseDto,
  OrganizationResponseDto,
} from '../dtos/organization.response.dto';
import { OrganizationMapper } from '../organization.mapper';
import type { NewOrganization, OrganizationAuthPort } from './organization-auth.port';
import { invokeOrganizationApi } from './organization-error.util';

/**
 * The organization port, over the Better Auth organization plugin's server API
 * (`auth.api.*`). Better Auth remains the single source of truth for the
 * organization and member tables; every call goes through
 * `invokeOrganizationApi`, which folds its errors onto this module's catalog.
 */
@Injectable()
export class OrganizationAuthGateway implements OrganizationAuthPort {
  async create(
    headers: IncomingHttpHeaders,
    input: NewOrganization,
  ): Promise<OrganizationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.createOrganization({
        body: { name: input.name, slug: input.slug, logo: input.logo },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toOrganization(result);
  }

  async update(
    headers: IncomingHttpHeaders,
    organizationId: string,
    data: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.updateOrganization({
        body: { data, organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toOrganization(result);
  }

  async delete(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<OrganizationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.deleteOrganization({
        body: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toOrganization(result);
  }

  async setActive(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<OrganizationResponseDto | null> {
    const result = await invokeOrganizationApi(() =>
      auth.api.setActiveOrganization({
        body: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return result ? OrganizationMapper.toOrganization(result) : null;
  }

  async list(headers: IncomingHttpHeaders): Promise<OrganizationResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listOrganizations({ headers: betterAuthHeaders(headers) }),
    );
    return OrganizationMapper.toOrganizations(result);
  }

  async getFull(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<FullOrganizationResponseDto | null> {
    const result = await invokeOrganizationApi(() =>
      auth.api.getFullOrganization({
        query: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return result ? OrganizationMapper.toFullOrganization(result) : null;
  }

  /** Better Auth throws when a slug is taken; translate that to a boolean. */
  async isSlugAvailable(headers: IncomingHttpHeaders, slug: string): Promise<boolean> {
    try {
      await auth.api.checkOrganizationSlug({
        body: { slug },
        headers: betterAuthHeaders(headers),
      });
      return true;
    } catch (err) {
      if (err instanceof APIError) return false;
      throw err;
    }
  }

  async listMembers(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<MemberResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listMembers({
        query: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toMembers(unwrapArray(result, 'members'));
  }

  async addMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    input: AddMemberDto,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.addMember({
        body: {
          userId: input.userId,
          role: input.role,
          organizationId,
          teamId: input.teamId,
        },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toMember(result);
  }

  async removeMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberIdOrEmail: string,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.removeMember({
        body: { memberIdOrEmail, organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toMember(unwrap(result, 'member'));
  }

  async updateMemberRole(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberId: string,
    role: string,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.updateMemberRole({
        body: { memberId, role, organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toMember(result);
  }

  async leave(headers: IncomingHttpHeaders, organizationId: string): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.leaveOrganization({
        body: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toMember(result);
  }
}
