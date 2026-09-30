import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { AddMemberDto, UpdateOrganizationDto } from '@oppenheimer/shared';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { betterAuthHeaders, unwrap } from '../../auth/infrastructure/better-auth.util';
import { OrganizationErrors } from '../domain/organization.errors';
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
 * (`auth.api.*`). Every call goes through `invokeOrganizationApi` (see
 * `betterAuthInvoker`).
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

  /**
   * Better Auth answers a taken slug with an error; that one error is the
   * answer "no". Any other failure — not signed in, the plugin refusing the
   * request — stays the problem document the invoker makes of it.
   */
  async isSlugAvailable(headers: IncomingHttpHeaders, slug: string): Promise<boolean> {
    try {
      await invokeOrganizationApi(() =>
        auth.api.checkOrganizationSlug({
          body: { slug },
          headers: betterAuthHeaders(headers),
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === OrganizationErrors.SLUG_TAKEN.code) {
        return false;
      }
      throw error;
    }
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
