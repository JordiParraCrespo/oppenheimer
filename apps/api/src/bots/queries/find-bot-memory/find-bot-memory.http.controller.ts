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
import { BotMemoryFactMapper } from '../../bot-memory-fact.mapper';
import type { BotMemoryFactEntity } from '../../domain/bot-memory-fact.entity';
import { BotMemoryFactResponseDto } from '../../dtos/bot-memory-fact.response.dto';
import { FindBotMemoryQuery } from './find-bot-memory.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotMemoryHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMemoryFactMapper,
  ) {}

  @Get(':id/memory')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({ summary: 'Read what a bot remembers', description: 'Newest first.' })
  @ApiResponse({ status: 200, type: [BotMemoryFactResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotMemoryFactResponseDto[]> {
    const facts = await this.queryBus.execute<FindBotMemoryQuery, BotMemoryFactEntity[]>(
      new FindBotMemoryQuery({ scope, botId }),
    );
    return facts.map((fact) => this.mapper.toResponse(fact));
  }
}
