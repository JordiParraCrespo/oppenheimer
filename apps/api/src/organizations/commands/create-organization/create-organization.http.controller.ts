import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import { CreateOrganizationCommand } from './create-organization.command';
import { CreateOrganizationRequest } from './create-organization.request.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class CreateOrganizationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @Version('1')
  @RequireScopes('organizations:write')
  @CheckPolicies({ action: 'create', subject: 'Organization' })
  @ApiOperation({ summary: 'Create an organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  create(
    @Req() req: Request,
    @Body() body: CreateOrganizationRequest,
    @CurrentUser('id') creatorId: string | undefined,
  ): Promise<OrganizationResponseDto> {
    return this.commandBus.execute<CreateOrganizationCommand, OrganizationResponseDto>(
      new CreateOrganizationCommand({ headers: req.headers, input: body, creatorId }),
    );
  }
}
