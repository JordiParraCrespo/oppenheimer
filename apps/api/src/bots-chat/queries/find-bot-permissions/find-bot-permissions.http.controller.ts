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
import { BotPermissionRuleMapper } from '../../bot-permission-rule.mapper';
import { BotToolPermissionMapper } from '../../bot-tool-permission.mapper';
import type { BotPermissionsView } from '../../domain/bot-tool-permission.policy';
import { BotPermissionsResponseDto } from '../../dtos/bot-permissions.response.dto';
import { FindBotPermissionsQuery } from './find-bot-permissions.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotPermissionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly tools: BotToolPermissionMapper,
    private readonly rules: BotPermissionRuleMapper,
  ) {}

  @Get(':id/permissions')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's permissions",
    description:
      'Every tool with where it stands for the bot (Allow, Ask or Off: its owner’s setting, else the preset’s default), the standing grants for single things, and the plain-language rules a reviewer reads before an asking call.',
  })
  @ApiResponse({ status: 200, type: BotPermissionsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<BotPermissionsResponseDto> {
    const view = await this.queryBus.execute<FindBotPermissionsQuery, BotPermissionsView>(
      new FindBotPermissionsQuery(scope, botId),
    );
    return this.tools.toPermissionsResponse(
      view,
      view.rules.map((rule) => this.rules.toResponse(rule)),
    );
  }
}
