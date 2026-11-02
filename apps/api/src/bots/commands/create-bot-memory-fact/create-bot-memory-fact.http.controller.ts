import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { FindBotMemoryFactQuery } from '../../queries/find-bot-memory-fact/find-bot-memory-fact.query';
import { CreateBotMemoryFactCommand } from './create-bot-memory-fact.command';
import { CreateBotMemoryFactRequest } from './create-bot-memory-fact.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class CreateBotMemoryFactHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMemoryFactMapper,
  ) {}

  @Post(':id/memory')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({ summary: 'Teach a bot a fact', description: 'One fact, in a sentence.' })
  @ApiResponse({ status: 201, type: BotMemoryFactResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 422,
    description: 'The bot remembers as much as it can',
    code: 'BOTS_009',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Body() body: CreateBotMemoryFactRequest,
  ): Promise<BotMemoryFactResponseDto> {
    const factId = await this.commandBus.execute<CreateBotMemoryFactCommand, string>(
      new CreateBotMemoryFactCommand({
        scope,
        botId,
        content: body.content,
        tier: body.tier,
        memoryScope: body.scope,
      }),
    );
    const fact = await this.queryBus.execute<FindBotMemoryFactQuery, BotMemoryFactEntity>(
      new FindBotMemoryFactQuery({ scope, botId, factId }),
    );
    return this.mapper.toResponse(fact);
  }
}
