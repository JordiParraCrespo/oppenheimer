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
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationListing } from '../../domain/automation-read.types';
import { BotRoutineResponseDto } from '../../dtos/bot-routine.response.dto';
import { FindBotRoutinesQuery } from './find-bot-routines.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotRoutinesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Get(':id/routines')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'List a bot’s routines',
    description:
      'The routines the bot runs on its own, oldest first, each with its triggers, whether it is on or running now, its next run and its latest run. A bot makes and changes them in chat; this is what its Routines tab reads.',
  })
  @ApiResponse({ status: 200, type: [BotRoutineResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotRoutineResponseDto[]> {
    const listing = await this.queryBus.execute<FindBotRoutinesQuery, AutomationListing>(
      new FindBotRoutinesQuery({ scope, botId }),
    );
    return listing.automations.map((routine) =>
      this.mapper.toRoutineResponse(routine, listing.digests.get(routine.id)),
    );
  }
}
