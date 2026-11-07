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
import { BotMemoryDreamMapper } from '../../bot-memory-dream.mapper';
import type { StoredDream } from '../../domain/bot-dream.policy';
import { BotMemoryDreamStateResponseDto } from '../../dtos/bot-memory-dream.response.dto';
import { FindBotMemoryDreamQuery } from './find-bot-memory-dream.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotMemoryDreamHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMemoryDreamMapper,
  ) {}

  @Get(':id/memory/dream')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "Read a bot's latest dream of its memory",
    description: '`latest` is null before its first.',
  })
  @ApiResponse({ status: 200, type: BotMemoryDreamStateResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotMemoryDreamStateResponseDto> {
    const dream = await this.queryBus.execute<FindBotMemoryDreamQuery, StoredDream | null>(
      new FindBotMemoryDreamQuery({ scope, botId }),
    );
    return this.mapper.toState(dream);
  }
}
