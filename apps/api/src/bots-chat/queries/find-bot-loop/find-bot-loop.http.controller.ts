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
import { BotLoopMapper } from '../../bot-loop.mapper';
import type { BotLoopEntity } from '../../domain/bot-loop.entity';
import { BotLoopStateResponseDto } from '../../dtos/bot-loop.response.dto';
import { FindBotLoopQuery } from './find-bot-loop.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotLoopHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotLoopMapper,
  ) {}

  @Get(':id/loop')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's loop",
    description:
      'The loop set with /loop: its prompt, its interval (null when the bot says when it runs next), how many runs it has made, when the next is due and when it expires; null when it has none.',
  })
  @ApiResponse({ status: 200, type: BotLoopStateResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotLoopStateResponseDto> {
    const loop = await this.queryBus.execute<FindBotLoopQuery, BotLoopEntity | null>(
      new FindBotLoopQuery(scope, botId),
    );
    const dto = new BotLoopStateResponseDto();
    dto.loop = loop ? this.mapper.toResponse(loop) : null;
    return dto;
  }
}
