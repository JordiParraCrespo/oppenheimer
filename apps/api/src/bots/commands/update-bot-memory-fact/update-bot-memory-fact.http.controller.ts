import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateBotMemoryFactCommand } from './update-bot-memory-fact.command';
import { UpdateBotMemoryFactRequest } from './update-bot-memory-fact.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UpdateBotMemoryFactHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMemoryFactMapper,
  ) {}

  @Patch(':id/memory/:factId')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({ summary: 'Reword a fact a bot remembers' })
  @ApiResponse({ status: 200, type: BotMemoryFactResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Memory fact not found', code: 'BOTS_008' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('factId', new ParseUUIDPipe()) factId: string,
    @Body() body: UpdateBotMemoryFactRequest,
  ): Promise<BotMemoryFactResponseDto> {
    await this.commandBus.execute<UpdateBotMemoryFactCommand, string>(
      new UpdateBotMemoryFactCommand({ scope, botId, factId, content: body.content }),
    );
    const fact = await this.queryBus.execute<FindBotMemoryFactQuery, BotMemoryFactEntity>(
      new FindBotMemoryFactQuery({ scope, botId, factId }),
    );
    return this.mapper.toResponse(fact);
  }
}
