import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationListing } from '../../domain/automation-read.types';
import { BotRoutineResponseDto } from '../../dtos/bot-routine.response.dto';
import { FindRoutinesQuery } from './find-routines.query';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class FindRoutinesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Get('routines')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'List the workspace’s bot routines',
    description:
      'Every bot’s routines, oldest first, each with its bot, its triggers, whether it is on or running now, its next run and its latest run. Session automations are `GET /automations`; one bot’s routines are `GET /bots/{id}/routines`.',
  })
  @ApiResponse({ status: 200, type: [BotRoutineResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<BotRoutineResponseDto[]> {
    const listing = await this.queryBus.execute<FindRoutinesQuery, AutomationListing>(
      new FindRoutinesQuery({ scope }),
    );
    return listing.automations.map((routine) =>
      this.mapper.toRoutineResponse(routine, listing.digests.get(routine.id)),
    );
  }
}
