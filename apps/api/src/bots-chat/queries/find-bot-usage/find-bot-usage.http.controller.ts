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
import type { BotUsage } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotUsageMapper } from '../../bot-usage.mapper';
import { BotUsageResponseDto } from '../../dtos/bot-usage.response.dto';
import { FindBotUsageQuery } from './find-bot-usage.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotUsageHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotUsageMapper,
  ) {}

  @Get(':id/usage')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "What a bot's chat has spent",
    description:
      "The tokens its turns spent, by model, and its calls on the owner's key outside them (goal reviews, summaries, rule reviews), since the chat's first turn. Cache reads and writes are part of the input.",
  })
  @ApiResponse({ status: 200, type: BotUsageResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotUsageResponseDto> {
    const usage = await this.queryBus.execute<FindBotUsageQuery, BotUsage>(
      new FindBotUsageQuery(scope, botId),
    );
    return this.mapper.toResponse(usage);
  }
}
