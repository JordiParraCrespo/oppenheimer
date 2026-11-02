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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotQuestionMapper } from '../../bot-question.mapper';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { BotPendingQuestionResponseDto } from '../../dtos/bot-question.response.dto';
import { FindPendingBotQuestionQuery } from './find-pending-bot-question.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindPendingBotQuestionHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotQuestionMapper,
  ) {}

  @Get(':id/question')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's waiting questions",
    description:
      'The card of questions the bot asked with `ask_user` and is waiting on; null when none waits. A bot has one card up at a time, questions or an approval.',
  })
  @ApiResponse({ status: 200, type: BotPendingQuestionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotPendingQuestionResponseDto> {
    const question = await this.queryBus.execute<
      FindPendingBotQuestionQuery,
      BotQuestionEntity | null
    >(new FindPendingBotQuestionQuery(scope, botId));
    const dto = new BotPendingQuestionResponseDto();
    dto.question = question ? this.mapper.toResponse(question) : null;
    return dto;
  }
}
