import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import { FindOrganizationQuery } from '../../queries/find-organization/find-organization.query';
import { SetActiveOrganizationCommand } from './set-active-organization.command';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class SetActiveOrganizationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/set-active')
  @Version('1')
  @RequireScopes('organizations:read')
  @OrganizationScoped('id')
  @NoPolicy('selects one of the caller’s own memberships; Better Auth verifies membership')
  @ApiOperation({
    summary: 'Set the active organization for the current session',
  })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  async setActive(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationResponseDto | null> {
    await this.commandBus.execute<SetActiveOrganizationCommand, AggregateID>(
      new SetActiveOrganizationCommand({ headers: req.headers, organizationId: id }),
    );
    return this.queryBus.execute<FindOrganizationQuery, OrganizationResponseDto>(
      new FindOrganizationQuery({ organizationId: id }),
    );
  }
}
