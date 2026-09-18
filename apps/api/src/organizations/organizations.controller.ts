import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { isOrganizationAllowed } from '@oppenheimer/shared';
import type { Request } from 'express';
import { CheckPolicies, NoPolicy } from '../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { OrganizationScoped } from '../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import {
  CheckSlugRequest,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from './dtos/organization.request.dto';
import {
  FullOrganizationResponseDto,
  OrganizationResponseDto,
  SlugAvailabilityResponseDto,
} from './dtos/organization.response.dto';
import { OrganizationsService } from './organizations.service';

/**
 * Organization endpoints — a typed, CASL-guarded REST surface that delegates to
 * the Better Auth organization plugin (`auth.api.*`). Static routes are ordered
 * before parameterized ones.
 */
@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 404,
  description: 'The organization does not exist, or is not visible to the caller',
  code: 'ORG_001',
})
@ApiProblemResponse({
  status: 502,
  description: 'The organization service failed to handle the request',
  code: 'ORG_016',
})
@ApiProblemResponse({
  status: 403,
  description:
    'The caller is not a member of the organization, or their org role does not allow this',
  code: ['ORG_003', 'ORG_004'],
})
@ApiProblemResponse({
  status: 409,
  description: 'The slug is taken, or an organization limit has been reached',
  code: ['ORG_002', 'ORG_014'],
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @Version('1')
  @RequireScopes('organizations:write')
  @CheckPolicies({ action: 'create', subject: 'Organization' })
  @ApiOperation({ summary: 'Create an organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  create(
    @Req() req: Request,
    @Body() body: CreateOrganizationRequest,
  ): Promise<OrganizationResponseDto> {
    return this.organizations.create(req.headers, body);
  }

  @Get()
  @Version('1')
  @RequireScopes('organizations:read')
  @CheckPolicies({ action: 'read', subject: 'Organization' })
  @ApiOperation({ summary: "List the caller's organizations" })
  @ApiResponse({ status: 200, type: [OrganizationResponseDto] })
  async list(
    @Req() req: Request,
    @CurrentScope() scope: ScopeContext | null,
  ): Promise<OrganizationResponseDto[]> {
    const organizations = await this.organizations.list(req.headers);
    // A collection route names no organization for `ScopesGuard` to check, so
    // a token pinned to one organization would otherwise see every one its
    // owner belongs to. Apply the credential's restriction row by row instead.
    return organizations.filter((organization) =>
      isOrganizationAllowed(scope?.resourceScope, organization.id),
    );
  }

  @Post('check-slug')
  @Version('1')
  @RequireScopes('organizations:read')
  @CheckPolicies({ action: 'read', subject: 'Organization' })
  @ApiOperation({ summary: 'Check whether an organization slug is available' })
  @ApiResponse({ status: 200, type: SlugAvailabilityResponseDto })
  checkSlug(
    @Req() req: Request,
    @Body() body: CheckSlugRequest,
  ): Promise<SlugAvailabilityResponseDto> {
    return this.organizations.checkSlug(req.headers, body.slug);
  }

  @Get(':id')
  @Version('1')
  @RequireScopes('organizations:read')
  @OrganizationScoped('id')
  @CheckPolicies({ action: 'read', subject: 'Organization' })
  @ApiOperation({
    summary: 'Get an organization with its members, invitations and workspaces',
  })
  @ApiResponse({ status: 200, type: FullOrganizationResponseDto })
  getFull(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FullOrganizationResponseDto | null> {
    return this.organizations.getFull(req.headers, id);
  }

  @Patch(':id')
  @Version('1')
  @RequireScopes('organizations:write')
  @OrganizationScoped('id')
  @CheckPolicies({ action: 'update', subject: 'Organization' })
  @ApiOperation({ summary: 'Update an organization' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrganizationRequest,
  ): Promise<OrganizationResponseDto> {
    return this.organizations.update(req.headers, id, body);
  }

  @Delete(':id')
  @Version('1')
  @RequireScopes('organizations:write')
  @OrganizationScoped('id')
  @CheckPolicies({ action: 'delete', subject: 'Organization' })
  @ApiOperation({ summary: 'Delete an organization' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto> {
    return this.organizations.delete(req.headers, id);
  }

  @Post(':id/set-active')
  @Version('1')
  @RequireScopes('organizations:read')
  @OrganizationScoped('id')
  @NoPolicy('selects one of the caller’s own memberships; Better Auth verifies membership')
  @ApiOperation({
    summary: 'Set the active organization for the current session',
  })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  setActive(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto | null> {
    return this.organizations.setActive(req.headers, id);
  }
}
