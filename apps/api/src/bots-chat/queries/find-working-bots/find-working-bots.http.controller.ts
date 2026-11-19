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
import { BotTurnMapper } from '../../bot-turn.mapper';
import { WorkingBotsResponseDto } from '../../dtos/working-bots.response.dto';
import { FindWorkingBotsQuery } from './find-working-bots.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('working-bots')
export class FindWorkingBotsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotTurnMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'The bots at work',
    description:
      'The bots you may read that have a turn queued or running. The workspace stream sends `botTurn.changed` when one may have started or stopped.',
  })
  @ApiResponse({ status: 200, type: WorkingBotsResponseDto })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<WorkingBotsResponseDto> {
    const botIds = await this.queryBus.execute<FindWorkingBotsQuery, string[]>(
      new FindWorkingBotsQuery(scope),
    );
    return this.mapper.toWorkingBotsResponse(botIds);
  }
}
