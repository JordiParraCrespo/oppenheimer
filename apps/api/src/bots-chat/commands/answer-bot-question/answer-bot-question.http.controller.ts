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
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotQuestionMapper } from '../../bot-question.mapper';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { BotQuestionResponseDto } from '../../dtos/bot-question.response.dto';
import { FindBotQuestionQuery } from '../../queries/find-bot-question/find-bot-question.query';
import { AnswerBotQuestionCommand } from './answer-bot-question.command';
import { AnswerBotQuestionRequest } from './answer-bot-question.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class AnswerBotQuestionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotQuestionMapper,
  ) {}

  @Post(':id/questions/:questionId/answer')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Answer a bot's questions",
    description:
      "One answer per question, in order: the options picked, by index, and the person's own words. The bot gets a turn that reads the answers, under the scopes both the asking turn and your credential cover. Nothing else runs.",
  })
  @ApiResponse({ status: 201, type: BotQuestionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Questions not found', code: 'BOTS_035' })
  @ApiProblemResponse({ status: 422, description: 'Answers that do not fit', code: 'BOTS_036' })
  @ApiProblemResponse({ status: 409, description: 'Already answered', code: 'BOTS_037' })
  async answer(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('name') name: string | undefined,
    @CurrentScope() credential: ScopeContext | null,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() body: AnswerBotQuestionRequest,
  ): Promise<BotQuestionResponseDto> {
    await this.commandBus.execute<AnswerBotQuestionCommand, string>(
      new AnswerBotQuestionCommand({
        scope,
        botId,
        questionId,
        answers: body.answers,
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
