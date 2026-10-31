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
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotPermissionRuleMapper } from '../../bot-permission-rule.mapper';
import { BotToolPermissionMapper } from '../../bot-tool-permission.mapper';
import type { BotPermissionsView } from '../../domain/bot-tool-permission.policy';
import { BotPermissionsResponseDto } from '../../dtos/bot-permissions.response.dto';
import { FindBotPermissionsQuery } from '../../queries/find-bot-permissions/find-bot-permissions.query';
import { CreateBotPermissionRuleCommand } from './create-bot-permission-rule.command';
import { CreateBotPermissionRuleRequest } from './create-bot-permission-rule.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class CreateBotPermissionRuleHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tools: BotToolPermissionMapper,
    private readonly rules: BotPermissionRuleMapper,
  ) {}

  @Post(':id/permissions/rules')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Add a permission rule to a bot',
    description:
      'A sentence a reviewer reads before the bot’s asking calls: `allow` lets a matching call run without a card, `ask` makes one ask; when both match, `ask` wins. At most 20 per bot. Answers the bot’s permissions as they now stand.',
  })
  @ApiResponse({ status: 201, type: BotPermissionsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The bot holds as many rules as it can',
    code: 'BOTS_031',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Body() body: CreateBotPermissionRuleRequest,
  ): Promise<BotPermissionsResponseDto> {
    await this.commandBus.execute<CreateBotPermissionRuleCommand, string>(
      new CreateBotPermissionRuleCommand({ scope, botId, effect: body.effect, text: body.text }),
    );
    const view = await this.queryBus.execute<FindBotPermissionsQuery, BotPermissionsView>(
      new FindBotPermissionsQuery(scope, botId),
    );
    return this.tools.toPermissionsResponse(
      view,
      view.rules.map((rule) => this.rules.toResponse(rule)),
    );
  }
}
