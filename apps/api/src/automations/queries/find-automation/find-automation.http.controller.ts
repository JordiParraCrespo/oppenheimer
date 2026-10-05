import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationDetail } from '../../domain/automation-read.types';
import { AutomationResponseDto } from '../../dtos/automation.response.dto';
import { FindAutomationQuery } from './find-automation.query';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class FindAutomationHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({ summary: 'Read one automation' })
  @ApiResponse({ status: 200, type: AutomationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Automation not found', code: 'AUTOMATIONS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) automationId: string,
  ): Promise<AutomationResponseDto> {
    const detail = await this.queryBus.execute<FindAutomationQuery, AutomationDetail>(
      new FindAutomationQuery({ scope, automationId }),
    );
    return this.mapper.toResponse(detail.automation, scope.userId, detail.digest);
  }
}
