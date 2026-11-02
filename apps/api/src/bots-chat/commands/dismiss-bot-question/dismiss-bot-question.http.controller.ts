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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotQuestionMapper } from '../../bot-question.mapper';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { BotQuestionResponseDto } from '../../dtos/bot-question.response.dto';
import { FindBotQuestionQuery } from '../../queries/find-bot-question/find-bot-question.query';
import { DismissBotQuestionCommand } from './dismiss-bot-question.command';
import { DismissBotQuestionRequest } from './dismiss-bot-question.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class DismissBotQuestionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotQuestionMapper,
  ) {}

  @Post(':id/questions/:questionId/dismiss')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Dismiss a bot's questions",
    description:
      'Declines to answer, with a note if you like. The bot gets a turn that is told so, under the scopes both the asking turn and your credential cover, and is asked not to ask again unless you bring it up.',
  })
  @ApiResponse({ status: 201, type: BotQuestionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Questions not found', code: 'BOTS_035' })
  @ApiProblemResponse({ status: 409, description: 'Already answered', code: 'BOTS_037' })
  async dismiss(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('name') name: string | undefined,
    @CurrentScope() credential: ScopeContext | null,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() body: DismissBotQuestionRequest,
  ): Promise<BotQuestionResponseDto> {
    await this.commandBus.execute<DismissBotQuestionCommand, string>(
      new DismissBotQuestionCommand({
        scope,
        botId,
        questionId,
        note: body.note ?? null,
        deciderName: name ?? '',
        credentialScopes: credential ? credential.scopes : null,
      }),
    );
    const question = await this.queryBus.execute<FindBotQuestionQuery, BotQuestionEntity>(
      new FindBotQuestionQuery(scope, botId, questionId),
    );
    return this.mapper.toResponse(question);
  }
}
