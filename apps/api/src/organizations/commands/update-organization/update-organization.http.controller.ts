import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import { UpdateOrganizationCommand } from './update-organization.command';
import { UpdateOrganizationRequest } from './update-organization.request.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class UpdateOrganizationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

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
    return this.commandBus.execute<UpdateOrganizationCommand, OrganizationResponseDto>(
      new UpdateOrganizationCommand({ headers: req.headers, organizationId: id, data: body }),
    );
  }
}
