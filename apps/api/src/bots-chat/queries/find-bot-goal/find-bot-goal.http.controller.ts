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
import { BotGoalMapper } from '../../bot-goal.mapper';
import type { BotGoalEntity } from '../../domain/bot-goal.entity';
import { BotGoalStateResponseDto } from '../../dtos/bot-goal.response.dto';
import { FindBotGoalQuery } from './find-bot-goal.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotGoalHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotGoalMapper,
  ) {}

  @Get(':id/goal')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's goal",
    description:
      'The goal the bot set itself and keeps working toward, with how many continuation turns it has taken of its limit; null when it has none.',
  })
  @ApiResponse({ status: 200, type: BotGoalStateResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotGoalStateResponseDto> {
    const goal = await this.queryBus.execute<FindBotGoalQuery, BotGoalEntity | null>(
      new FindBotGoalQuery(scope, botId),
    );
    const dto = new BotGoalStateResponseDto();
    dto.goal = goal ? this.mapper.toResponse(goal) : null;
    return dto;
  }
}
