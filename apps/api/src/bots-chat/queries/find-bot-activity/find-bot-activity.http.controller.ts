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
import { BotActivityResponseDto } from '../../dtos/bot-activity.response.dto';
import { type BotActivity, FindBotActivityQuery } from './find-bot-activity.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bot-activity')
export class FindBotActivityHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotTurnMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: 'What the bots are doing',
    description:
      'Of the bots you may read: those working (a turn queued or running) and those waiting on you (an approval or questions pending, or a failed turn since you last read the chat). The workspace stream sends `botTurn.changed` and `botApproval.changed` when either may have moved.',
  })
  @ApiResponse({ status: 200, type: BotActivityResponseDto })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<BotActivityResponseDto> {
    const activity = await this.queryBus.execute<FindBotActivityQuery, BotActivity>(
      new FindBotActivityQuery(scope),
    );
    return this.mapper.toActivityResponse(activity);
  }
}
