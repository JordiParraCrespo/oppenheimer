import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { SlugAvailabilityResponseDto } from '../../dtos/organization.response.dto';
import { CheckSlugQuery } from './check-slug.query';
import { CheckSlugRequest } from './check-slug.request.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class CheckSlugHttpController {
  constructor(private readonly queryBus: QueryBus) {}

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
    return this.queryBus.execute<CheckSlugQuery, SlugAvailabilityResponseDto>(
      new CheckSlugQuery({ headers: req.headers, slug: body.slug }),
    );
  }
}
