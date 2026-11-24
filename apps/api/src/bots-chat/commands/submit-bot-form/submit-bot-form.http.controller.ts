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
import { BotFormMapper } from '../../bot-form.mapper';
import type { BotFormEntity } from '../../domain/bot-form.entity';
import { BotFormResponseDto } from '../../dtos/bot-form.response.dto';
import { FindBotFormQuery } from '../../queries/find-bot-form/find-bot-form.query';
import { SubmitBotFormCommand } from './submit-bot-form.command';
import { SubmitBotFormRequest } from './submit-bot-form.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class SubmitBotFormHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotFormMapper,
  ) {}

  @Post(':id/forms/:formId/submit')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Submit a bot's form",
    description:
      'A value per field id: words, or a number for a number field; null or blank for a field left empty. Each must fit its field. The bot gets a turn that reads them, under the scopes both the asking turn and your credential cover. Nothing else runs.',
  })
  @ApiResponse({ status: 201, type: BotFormResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Form not found', code: 'BOTS_046' })
  @ApiProblemResponse({ status: 422, description: 'Values that do not fit', code: 'BOTS_047' })
  @ApiProblemResponse({ status: 409, description: 'Already sent', code: 'BOTS_048' })
  async submit(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('name') name: string | undefined,
    @CurrentScope() credential: ScopeContext | null,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('formId', new ParseUUIDPipe()) formId: string,
    @Body() body: SubmitBotFormRequest,
  ): Promise<BotFormResponseDto> {
    await this.commandBus.execute<SubmitBotFormCommand, string>(
      new SubmitBotFormCommand({
        scope,
        botId,
        formId,
        values: body.values,
        deciderName: name ?? '',
        credentialScopes: credential ? credential.scopes : null,
      }),
    );
    const form = await this.queryBus.execute<FindBotFormQuery, BotFormEntity>(
      new FindBotFormQuery(scope, botId, formId),
    );
    return this.mapper.toResponse(form);
  }
}
