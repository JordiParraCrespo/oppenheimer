import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import { FindOrganizationQuery } from '../../queries/find-organization/find-organization.query';
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
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @Version('1')
  @RequireScopes('organizations:write')
  @CheckPolicies({ action: 'create', subject: 'Organization' })
  @ApiOperation({ summary: 'Create an organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  async create(
    @Req() req: Request,
    @Body() body: CreateOrganizationRequest,
    @CurrentUser('id') creatorId: string | undefined,
  ): Promise<OrganizationResponseDto> {
    const id = await this.commandBus.execute<CreateOrganizationCommand, AggregateID>(
      new CreateOrganizationCommand({ headers: req.headers, input: body, creatorId }),
    );
    return this.queryBus.execute<FindOrganizationQuery, OrganizationResponseDto>(
      new FindOrganizationQuery({ organizationId: id }),
    );
  }
}
