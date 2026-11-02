import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Put,
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
import { BotPermissionRuleMapper } from '../../bot-permission-rule.mapper';
import { BotToolPermissionMapper } from '../../bot-tool-permission.mapper';
import type { BotPermissionsView } from '../../domain/bot-tool-permission.policy';
import { BotPermissionsResponseDto } from '../../dtos/bot-permissions.response.dto';
import { FindBotPermissionsQuery } from '../../queries/find-bot-permissions/find-bot-permissions.query';
import { SetBotToolDecisionCommand } from './set-bot-tool-decision.command';
import { SetBotToolDecisionRequest } from './set-bot-tool-decision.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class SetBotToolDecisionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tools: BotToolPermissionMapper,
    private readonly rules: BotPermissionRuleMapper,
  ) {}

  @Put(':id/permissions/tools/:tool')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Set what a bot may do with one tool',
    description:
      '`allow` runs it without asking, `ask` raises a Needs input card, `off` takes it away; `default` drops the setting so the tool follows the preset. Answers the bot’s permissions as they now stand.',
  })
  @ApiResponse({ status: 200, type: BotPermissionsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'No such tool', code: 'BOTS_029' })
  @ApiProblemResponse({
    status: 422,
    description: 'This tool is decided call by call',
    code: 'BOTS_030',
  })
  async set(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('tool') tool: string,
    @Body() body: SetBotToolDecisionRequest,
  ): Promise<BotPermissionsResponseDto> {
    await this.commandBus.execute<SetBotToolDecisionCommand, string>(
      new SetBotToolDecisionCommand({ scope, botId, tool, decision: body.decision }),
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
