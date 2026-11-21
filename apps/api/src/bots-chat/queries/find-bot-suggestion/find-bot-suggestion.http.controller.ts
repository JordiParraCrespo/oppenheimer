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
import { BotSuggestionResponseDto } from '../../dtos/bot-suggestion.response.dto';
import { FindBotSuggestionQuery } from './find-bot-suggestion.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotSuggestionHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/suggestion')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A guess at the person's next message",
    description:
      "After the bot answers, its own model guesses the person's next message, which the composer offers to take with Tab. Null while a turn runs, before the bot has answered, or when there is no clear next step. Kept per message it answers, so asking again costs nothing.",
  })
  @ApiResponse({ status: 200, type: BotSuggestionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotSuggestionResponseDto> {
    const dto = new BotSuggestionResponseDto();
    dto.suggestion = await this.queryBus.execute<FindBotSuggestionQuery, string | null>(
      new FindBotSuggestionQuery(scope, botId),
    );
    return dto;
  }
}
